import type { FormSchema } from "@/lib/schema";

// Auto-discover all form definitions from the top-level forms/ directory.
// To add a form: create forms/<slug>.form.ts — no registration step needed here.
const modules = import.meta.glob("../../forms/*.form.ts", {
  eager: true,
}) as Record<string, { default: FormSchema }>;

export const forms: FormSchema[] = Object.values(modules).map((m) => m.default);

export function getForm(slug: string): FormSchema | undefined {
  return forms.find((f) => f.slug === slug);
}
