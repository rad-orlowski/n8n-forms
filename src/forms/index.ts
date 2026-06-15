import type { FormSchema } from "@/lib/schema";

// Auto-discover all form definitions under the top-level forms/ directory
// (including subfolders like forms/examples/). To add a form: create
// forms/<slug>.form.ts — no registration step needed here.
const modules = import.meta.glob("../../forms/**/*.form.ts", {
  eager: true,
}) as Record<string, { default: FormSchema }>;

// Forms living under forms/examples/ are demo/sample forms. They can be hidden
// from the console via the SHOW_EXAMPLE_FORMS server flag (see /api/config).
// Example-ness is derived from the source path at build time, not stored on the
// schema, so form definitions stay free of console-display concerns.
const EXAMPLE_PATH_RE = /\/examples\//;

const exampleSlugs = new Set<string>(
  Object.entries(modules)
    .filter(([path]) => EXAMPLE_PATH_RE.test(path))
    .map(([, m]) => m.default.slug),
);

export const forms: FormSchema[] = Object.values(modules).map((m) => m.default);

/** True when the given slug belongs to a form under forms/examples/. */
export function isExampleForm(slug: string): boolean {
  return exampleSlugs.has(slug);
}

export function getForm(slug: string): FormSchema | undefined {
  return forms.find((f) => f.slug === slug);
}

/**
 * The forms visible in the console given the example-forms flag.
 * When `showExamples` is false, forms under forms/examples/ are omitted.
 */
export function visibleForms(showExamples: boolean): FormSchema[] {
  return showExamples ? forms : forms.filter((f) => !isExampleForm(f.slug));
}
