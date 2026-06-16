/**
 * forms-loader.ts — scans a directory tree for form definition files and
 * validates them against FormSchema.
 *
 * Supported file extensions (matched by name suffix):
 *   *.form.json5   — JSON5 format
 *   *.form.yaml    — YAML format
 *   *.form.yml     — YAML format
 *
 * Returns two arrays:
 *   forms     — successfully parsed + validated FormSchema objects
 *   rejected  — files that failed to parse or validate, each with an errors array
 *
 * Guarantees:
 *   - Empty result (no error thrown) when the directory is missing.
 *   - All files sharing a slug are placed in `rejected` (none in `forms`).
 *   - Scans recursively into subdirectories.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join } from "node:path";
import JSON5 from "json5";
import { parse as parseYaml } from "yaml";
import { FormSchema } from "../lib/schema.ts";
import { FORMS_DIR } from "./config.ts";

export interface RejectedForm {
  /** Absolute path of the file that was rejected. */
  file: string;
  /** One entry per error (parse error message or individual Zod issue). */
  errors: string[];
}

export interface LoadResult {
  forms: FormSchema[];
  rejected: RejectedForm[];
  /** Slugs whose source path is under an `examples/` directory. */
  exampleSlugs: string[];
}

/** Matches any path segment named `examples`. */
const EXAMPLE_PATH_RE = /(^|[\\/])examples[\\/]/;

/** Extensions this loader handles, mapped to a parse function. */
const PARSERS: Record<string, (src: string) => unknown> = {
  ".json5": (src) => JSON5.parse(src),
  ".yaml": (src) => parseYaml(src),
  ".yml": (src) => parseYaml(src),
};

/** True for files whose name ends in `.form.<ext>`. */
function isFormFile(name: string): boolean {
  return /\.form\.(json5|ya?ml)$/.test(name);
}

/** Collect all form files under `dir` recursively. */
function collectFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFiles(abs));
    } else if (entry.isFile() && isFormFile(entry.name)) {
      results.push(abs);
    }
  }
  return results;
}

/**
 * Parse and validate every form file in `dir` (recursive).
 * Returns `{ forms, rejected, exampleSlugs }`. Never throws. Synchronous.
 */
export function loadFormsFromDir(dir: string): LoadResult {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return { forms: [], rejected: [], exampleSlugs: [] };
  }

  const files = collectFiles(dir);

  // --- parse + validate each file ---
  const valid: Array<{ file: string; form: FormSchema }> = [];
  const rejected: RejectedForm[] = [];
  // Track whether each slug came from an examples/ subdirectory.
  const exampleBySlug = new Map<string, boolean>();

  for (const file of files) {
    const ext = extname(file) as keyof typeof PARSERS;
    const parser = PARSERS[ext];
    if (!parser) {
      rejected.push({ file, errors: [`unsupported extension: ${ext}`] });
      continue;
    }

    let raw: unknown;
    try {
      raw = parser(readFileSync(file, "utf8"));
    } catch (err) {
      rejected.push({
        file,
        errors: [`parse error: ${(err as Error).message}`],
      });
      continue;
    }

    const result = FormSchema.safeParse(raw);
    if (!result.success) {
      const errors = result.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      );
      rejected.push({ file, errors });
      continue;
    }

    // Derive relative path from the root dir for example detection.
    const rel = file.slice(dir.length);
    exampleBySlug.set(result.data.slug, EXAMPLE_PATH_RE.test(rel));
    valid.push({ file, form: result.data });
  }

  // --- enforce unique slugs ---
  const deduped = enforceUniqueSlugs(valid, rejected);
  return {
    ...deduped,
    exampleSlugs: deduped.forms
      .filter((f) => exampleBySlug.get(f.slug))
      .map((f) => f.slug),
  };
}

/**
 * Move every entry whose slug appears more than once from `valid` into
 * `rejected`. Returns the deduplicated `{ forms, rejected }` — the caller
 * is responsible for adding `exampleSlugs`.
 */
function enforceUniqueSlugs(
  valid: Array<{ file: string; form: FormSchema }>,
  rejected: RejectedForm[],
): { forms: FormSchema[]; rejected: RejectedForm[] } {
  // Count occurrences of each slug across valid entries.
  const slugCount = new Map<string, number>();
  for (const { form } of valid) {
    slugCount.set(form.slug, (slugCount.get(form.slug) ?? 0) + 1);
  }

  const forms: FormSchema[] = [];
  const extraRejected: RejectedForm[] = [];

  for (const { file, form } of valid) {
    if ((slugCount.get(form.slug) ?? 0) > 1) {
      extraRejected.push({
        file,
        errors: [
          `slug "${form.slug}" is declared by ${slugCount.get(form.slug)} files — all rejected`,
        ],
      });
    } else {
      forms.push(form);
    }
  }

  return { forms, rejected: [...rejected, ...extraRejected] };
}

/** Apply the SHOW_EXAMPLE_FORMS policy to a load result. */
export function filterVisible(
  result: LoadResult,
  showExamples: boolean,
): LoadResult {
  if (showExamples) return result;
  return {
    ...result,
    forms: result.forms.filter((f) => !result.exampleSlugs.includes(f.slug)),
  };
}

// ---------------------------------------------------------------------------
// Cache accessor
// ---------------------------------------------------------------------------

let cache: LoadResult | null = null;

/** Re-read + validate `dir` (default FORMS_DIR), update the cache, log a summary. */
export function reloadForms(dir: string = FORMS_DIR): LoadResult {
  const result = loadFormsFromDir(dir);
  cache = result;
  logSummary(result);
  return result;
}

/** Return the cached result, loading once on first access. */
export function getForms(): LoadResult {
  return cache ?? reloadForms();
}

/** Clear the in-memory cache (test isolation / forced cold reload). */
export function resetFormsCache(): void {
  cache = null;
}

/**
 * Browser-safe view of a LoadResult: rejected file paths are reduced to their
 * basename so the HTTP response never leaks absolute server paths / directory
 * layout (personal forms may live in a gitignored external dir).
 */
export function toPublicForms(result: LoadResult): LoadResult {
  return {
    forms: result.forms,
    rejected: result.rejected.map((r) => ({ ...r, file: basename(r.file) })),
    exampleSlugs: result.exampleSlugs,
  };
}

function logSummary(result: LoadResult): void {
  for (const r of result.rejected) {
    console.error(`[forms] rejected ${r.file}:\n  ${r.errors.join("\n  ")}`);
  }
  console.log(
    `[forms] loaded ${result.forms.length} valid, ${result.rejected.length} rejected`,
  );
}
