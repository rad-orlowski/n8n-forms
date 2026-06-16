import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadFormsFromDir,
  getForms,
  reloadForms,
  toPublicForms,
  filterVisible,
} from "./forms-loader.ts";

/** Minimal valid form payload as a JS object. */
function validForm(slug: string) {
  return {
    slug,
    title: `Form ${slug}`,
    pages: [{ fields: [{ type: "text", name: "q" }] }],
  };
}

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "forms-loader-test-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

/** Write a file relative to the temp dir. */
function write(rel: string, content: string) {
  const abs = join(dir, rel);
  mkdirSync(abs.slice(0, abs.lastIndexOf("/")), { recursive: true });
  writeFileSync(abs, content, "utf8");
}

// ---------------------------------------------------------------------------
// 1. Returns an empty result for a missing directory
// ---------------------------------------------------------------------------
describe("loadFormsFromDir", () => {
  it("returns empty result for a missing directory", () => {
    const result = loadFormsFromDir("/tmp/__does_not_exist_ever__");
    expect(result.forms).toEqual([]);
    expect(result.rejected).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // 2. Parses a valid JSON5 file
  // -------------------------------------------------------------------------
  it("parses a valid JSON5 form file", () => {
    const payload = validForm("contact");
    write("contact.form.json5", `// json5 comment\n${JSON.stringify(payload)}`);
    const { forms, rejected } = loadFormsFromDir(dir);
    expect(rejected).toEqual([]);
    expect(forms).toHaveLength(1);
    expect(forms[0].slug).toBe("contact");
  });

  // -------------------------------------------------------------------------
  // 3. Parses a valid YAML file
  // -------------------------------------------------------------------------
  it("parses a valid YAML form file", () => {
    write(
      "signup.form.yaml",
      `slug: signup\ntitle: Sign Up\npages:\n  - fields:\n      - type: text\n        name: email\n`,
    );
    const { forms, rejected } = loadFormsFromDir(dir);
    expect(rejected).toEqual([]);
    expect(forms).toHaveLength(1);
    expect(forms[0].slug).toBe("signup");
  });

  // -------------------------------------------------------------------------
  // 4. Rejects a file with invalid schema (missing required field)
  // -------------------------------------------------------------------------
  it("rejects a file that fails FormSchema validation", () => {
    // Missing `title` — invalid per FormSchema
    write(
      "bad.form.json5",
      JSON.stringify({ slug: "bad", pages: [{ fields: [{ type: "text" }] }] }),
    );
    const { forms, rejected } = loadFormsFromDir(dir);
    expect(forms).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].file).toMatch(/bad\.form\.json5$/);
    expect(rejected[0].errors.join(" ")).toMatch(/title/i);
  });

  // -------------------------------------------------------------------------
  // 5. Rejects a file with malformed JSON5/YAML (parse error)
  // -------------------------------------------------------------------------
  it("rejects a file with a parse error", () => {
    write("broken.form.json5", "{ this is: not valid json5 !!!");
    const { forms, rejected } = loadFormsFromDir(dir);
    expect(forms).toEqual([]);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].file).toMatch(/broken\.form\.json5$/);
    expect(rejected[0].errors.length).toBeGreaterThan(0);
  });

  // -------------------------------------------------------------------------
  // 6. Rejects ALL files that share a slug (slug-conflict)
  // -------------------------------------------------------------------------
  it("rejects all files sharing a duplicate slug", () => {
    write("a.form.json5", JSON.stringify(validForm("dup")));
    write(
      "b.form.yaml",
      `slug: dup\ntitle: Dup B\npages:\n  - fields:\n      - type: text\n`,
    );
    const { forms, rejected } = loadFormsFromDir(dir);
    expect(forms).toEqual([]);
    expect(rejected).toHaveLength(2);
    expect(rejected.every((r) => /slug/i.test(r.errors.join(" ")))).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. Scans subdirectories recursively
  // -------------------------------------------------------------------------
  it("scans subdirectories recursively", () => {
    write(
      "nested/deep/contact.form.json5",
      JSON.stringify(validForm("contact")),
    );
    const { forms, rejected } = loadFormsFromDir(dir);
    expect(rejected).toEqual([]);
    expect(forms).toHaveLength(1);
    expect(forms[0].slug).toBe("contact");
  });
});

describe("cache accessor", () => {
  it("reloadForms(dir) refreshes the cached result", () => {
    write("a.form.json5", `{ slug: "a", title: "A", pages: [{ fields: [] }] }`);
    const first = reloadForms(dir);
    expect(first.forms.map((f) => f.slug)).toEqual(["a"]);
    write("c.form.json5", `{ slug: "c", title: "C", pages: [{ fields: [] }] }`);
    const second = reloadForms(dir);
    expect(second.forms.map((f) => f.slug).sort()).toEqual(["a", "c"]);
    // getForms(dir) returns the last loaded result for that dir without re-reading
    expect(getForms(dir)).toBe(second);
  });

  it("caches per-directory — a second dir does not clobber the first", () => {
    const dirB = mkdtempSync(join(tmpdir(), "forms-loader-test-b-"));
    try {
      write(
        "a.form.json5",
        `{ slug: "a", title: "A", pages: [{ fields: [] }] }`,
      );
      writeFileSync(
        join(dirB, "b.form.json5"),
        `{ slug: "b", title: "B", pages: [{ fields: [] }] }`,
      );
      const resA = reloadForms(dir);
      const resB = reloadForms(dirB);
      // Each dir keeps its own cached result; loading B must not evict A.
      expect(getForms(dir)).toBe(resA);
      expect(getForms(dirB)).toBe(resB);
      expect(getForms(dir).forms.map((f) => f.slug)).toEqual(["a"]);
      expect(getForms(dirB).forms.map((f) => f.slug)).toEqual(["b"]);
    } finally {
      rmSync(dirB, { recursive: true, force: true });
    }
  });
});

describe("toPublicForms", () => {
  it("reduces rejected file paths to basename and leaves forms + errors intact", () => {
    const result = {
      forms: [],
      rejected: [
        { file: "/Users/secret/private/forms/x.form.json5", errors: ["boom"] },
      ],
    };
    const pub = toPublicForms(result as never);
    expect(pub.rejected[0].file).toBe("x.form.json5");
    expect(pub.rejected[0].file.includes("/")).toBe(false);
    expect(pub.rejected[0].errors).toEqual(["boom"]);
  });
});

// ---------------------------------------------------------------------------
// example-ness + filterVisible
// ---------------------------------------------------------------------------
describe("example-ness + filterVisible", () => {
  it("marks forms under examples/ as example slugs", () => {
    mkdirSync(join(dir, "examples"));
    writeFileSync(
      join(dir, "examples", "e.form.json5"),
      `{ slug: "e", title: "E", pages: [{ fields: [] }] }`,
    );
    write(
      "real.form.json5",
      `{ slug: "real", title: "R", pages: [{ fields: [] }] }`,
    );
    const r = loadFormsFromDir(dir);
    expect(r.exampleSlugs).toEqual(["e"]);
  });

  it("filterVisible drops example forms when showExamples is false", () => {
    const result = {
      forms: [
        { slug: "e", title: "E", pages: [{ fields: [] }] },
        { slug: "real", title: "R", pages: [{ fields: [] }] },
      ],
      rejected: [],
      exampleSlugs: ["e"],
    } as never;
    const visible = filterVisible(result, false);
    expect(visible.forms.map((f: { slug: string }) => f.slug)).toEqual([
      "real",
    ]);
    // The examples were just stripped, so no example slug can survive.
    expect(visible.exampleSlugs).toEqual([]);
  });

  it("filterVisible keeps everything when showExamples is true", () => {
    const result = {
      forms: [{ slug: "e" }],
      rejected: [],
      exampleSlugs: ["e"],
    } as never;
    expect(filterVisible(result, true).forms).toHaveLength(1);
  });
});
