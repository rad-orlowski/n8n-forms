import type { ComponentType } from "react";
import type { ControllerRenderProps, FieldValues } from "react-hook-form";
import { z } from "zod";
import { validateExpressionSyntax } from "./expr";

/**
 * Field + form contract shared by the whole system.
 *
 * - A *form* is one file in forms/*.form.json5 (or .yaml) validated by defineForm().
 * - A *field* is rendered by a component registered in src/components/fields/index.ts
 *   keyed by `type`. Add a new `type` string + component there to extend the system;
 *   no other file needs to change.
 */

export const FieldOptionSchema = z.object({
  label: z.string(),
  value: z.string(),
});
export type FieldOption = z.infer<typeof FieldOptionSchema>;

const TimeoutSchema = z.union([z.number(), z.literal("indefinite")]);

export const FieldDefSchema = z.object({
  type: z.string().min(1),
  name: z.string().optional(),
  label: z.string().optional(),
  description: z.string().optional(),
  placeholder: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(FieldOptionSchema).optional(),
  optionsFrom: z.string().optional(),
  valueFrom: z.string().optional(),
  optionLabel: z.array(z.string()).optional(),
  optionValue: z.string().optional(),
  valueFromField: z.string().optional(),
  /**
   * Seed this field's initial value from a URL query param of the given name
   * (e.g. `prefillFromQuery: "opp"` reads `#/act?opp=…`). For a dynamic select
   * the value is only applied when it matches a loaded option (stale-value
   * guard). Reads the URL, not n8n step data, so it's allowed on any page.
   */
  prefillFromQuery: z.string().optional(),
  /** Declarative visibility expression — evaluated in Stage C. */
  visibleIf: z.string().optional(),
  /** Declarative conditional-required expression — evaluated in Stage C. */
  requiredIf: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  content: z.string().optional(),
  src: z.string().optional(),
  variant: z.enum(["info", "warning", "danger", "success"]).optional(),
  level: z.union([z.literal(2), z.literal(3)]).optional(),
});
export type FieldDef = z.infer<typeof FieldDefSchema>;

export const PageDefSchema = z.object({
  id: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  retryable: z.boolean().optional(),
  resumeUrlPath: z.string().optional(),
  submitLabel: z.string().optional(),
  method: z.enum(["GET", "POST"]).optional(),
  timeoutMs: TimeoutSchema.optional(),
  fields: z.array(FieldDefSchema),
});
export type PageDef = z.infer<typeof PageDefSchema>;

export const TableColumnSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  sortable: z.boolean().optional(),
  align: z.enum(["left", "right"]).optional(),
  /** Name of a registered cell renderer (see components/table/registry.ts). */
  kind: z.string().optional(),
});
export type TableColumn = z.infer<typeof TableColumnSchema>;

export const TableExpandSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  /** Name of a registered section renderer (see components/table/registry.ts). */
  kind: z.string().optional(),
});
export type TableExpand = z.infer<typeof TableExpandSchema>;

export const TableFilterSchema = z.object({
  key: z.string(),
  label: z.string(),
});
export type TableFilter = z.infer<typeof TableFilterSchema>;

export const ResponseFieldSchema = z.object({
  key: z.string(),
  label: z.string().optional(),
  format: z
    .enum(["heading", "tags", "list", "transcript", "copy", "table"])
    .optional(),
  prose: z.boolean().optional(),
  section: z.string().optional(),
  hideIfEmpty: z.boolean().optional(),
  columns: z.array(TableColumnSchema).optional(),
  expand: z.array(TableExpandSchema).optional(),
  filters: z.array(TableFilterSchema).optional(),
});

export const ResponseHeaderSchema = z.object({
  style: z.enum(["compact", "full", "none"]).optional(),
  heading: z.string().optional(),
  message: z.string().optional(),
  title: z.string().optional(),
});

export const ResponseConfigSchema = z.object({
  header: ResponseHeaderSchema.optional(),
  fields: z.array(ResponseFieldSchema).optional(),
});
export type ResponseConfig = z.infer<typeof ResponseConfigSchema>;

export const FormSchema = z
  .object({
    slug: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    icon: z.string().optional(),
    pages: z.array(PageDefSchema).min(1),
    submitLabel: z.string().optional(),
    timeoutMs: TimeoutSchema.optional(),
    response: ResponseConfigSchema.optional(),
  })
  .superRefine((schema, ctx) => {
    (schema.pages[0]?.fields ?? []).forEach((field, fieldIdx) => {
      if (field.optionsFrom != null) {
        ctx.addIssue({
          code: "custom",
          path: ["pages", 0, "fields", fieldIdx, "optionsFrom"],
          message: `field "${field.name ?? field.type}" uses optionsFrom on page 0 — dynamic fields require page index >= 1.`,
        });
      }
      if (field.valueFrom != null) {
        ctx.addIssue({
          code: "custom",
          path: ["pages", 0, "fields", fieldIdx, "valueFrom"],
          message: `field "${field.name ?? field.type}" uses valueFrom on page 0 — dynamic fields require page index >= 1.`,
        });
      }
    });

    schema.pages.forEach((p, pageIdx) => {
      p.fields.forEach((field, fieldIdx) => {
        for (const key of ["visibleIf", "requiredIf"] as const) {
          const expr = field[key];
          if (expr == null) continue;
          const result = validateExpressionSyntax(expr);
          if (!result.ok) {
            ctx.addIssue({
              code: "custom",
              path: ["pages", pageIdx, "fields", fieldIdx, key],
              message: `${key} is not a valid expression: ${result.error}`,
            });
          }
        }
      });
    });
  });
export type FormSchema = z.infer<typeof FormSchema>;

/** Optional typed authoring aid for in-repo forms; validates via the Zod schema. */
export function defineForm(schema: FormSchema): FormSchema {
  return FormSchema.parse(schema);
}

/**
 * Default synchronous-reply timeout (ms) when a form/page declares none.
 * Matches the BFF's historical n8n timeout so existing forms are unaffected.
 */
export const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Resolve the effective synchronous-reply timeout for a page: page override →
 * form default → `DEFAULT_TIMEOUT_MS`. Returns a millisecond number or the
 * literal `"indefinite"`. Used by FormShell to drive the client request and
 * forwarded to the BFF so both hops share one bound.
 */
export function resolveTimeoutMs(
  schema: FormSchema,
  page: PageDef,
): number | "indefinite" {
  return page.timeoutMs ?? schema.timeoutMs ?? DEFAULT_TIMEOUT_MS;
}

/**
 * Props every field component receives. The component renders ONLY the control
 * (input/select/etc.); FormShell supplies the label, description and error slot.
 */
export interface FieldComponentProps {
  field: ControllerRenderProps<FieldValues, string>;
  def: FieldDef;
}

export type FieldComponent = ComponentType<FieldComponentProps>;

/**
 * Field types that are pure display elements — they have no RHF registration,
 * no Zod schema entry, and no value in the webhook payload.
 */
export const STATIC_FIELD_TYPES = new Set([
  "heading",
  "description",
  "image",
  "alert",
]);

/** Returns true for display-only fields that carry no form value. */
export function isStaticField(def: FieldDef): boolean {
  return STATIC_FIELD_TYPES.has(def.type);
}

/**
 * Build a Zod validation schema from a single page's field list.
 * Call this with `page.fields` for the active page; FormShell resolves
 * per-page before rendering.
 */
export function buildZodSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const f of fields) {
    if (isStaticField(f)) continue; // display-only — no validation
    if (!f.name) continue; // safety guard for misconfigured input fields
    let s: z.ZodTypeAny;

    switch (f.type) {
      case "email": {
        const base = z.string().email("Enter a valid email address");
        s = f.required
          ? base.min(1, "This field is required")
          : z.union([z.literal(""), base]).optional();
        break;
      }
      case "url": {
        const base = z.string().url("Enter a valid URL");
        s = f.required
          ? base.min(1, "This field is required")
          : z.union([z.literal(""), base]).optional();
        break;
      }
      case "number":
      case "rating": {
        let num = z.coerce.number({ error: "Enter a number" });
        if (f.min != null) num = num.min(f.min, `Must be ≥ ${f.min}`);
        if (f.max != null) num = num.max(f.max, `Must be ≤ ${f.max}`);
        // An optional numeric left untouched must stay *absent* from the payload,
        // not coerce to 0. defaultValues seeds `undefined`; the empty-string an
        // input may emit is normalised back to undefined before .optional() so
        // the key is omitted rather than sent as 0.
        s = f.required
          ? num
          : z.preprocess(
              (v) =>
                v === "" || v === null || v === undefined ? undefined : v,
              num.optional(),
            );
        break;
      }
      case "checkbox": {
        s = f.required
          ? z.boolean().refine((v) => v === true, "This must be checked")
          : z.boolean().optional();
        break;
      }
      case "richtext": {
        // TipTap emits markup even when "empty" (e.g. "<p></p>"), so a plain
        // min(1) would pass. Strip tags + entities to test for real content.
        const hasContent = (html: string) =>
          html
            .replace(/<[^>]*>/g, "")
            .replace(/&nbsp;|&#160;/g, " ")
            .trim().length > 0 || /<(img|iframe|video|audio)\b/i.test(html);
        const base = z.string();
        s = f.required
          ? base.refine(hasContent, "This field is required")
          : base.optional();
        break;
      }
      default: {
        // text, textarea, select, date and any custom string-valued field
        const base = z.string();
        s = f.required
          ? base.min(1, "This field is required")
          : base.optional();
      }
    }

    shape[f.name] = s;
  }

  return z.object(shape);
}

/**
 * Default values keyed by field name, so RHF inputs stay controlled.
 * Call this with `page.fields` for the active page.
 */
export function defaultValues(fields: FieldDef[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of fields) {
    if (isStaticField(f) || !f.name) continue;
    // Optional numerics seed `undefined` so an untouched field is omitted from
    // the payload (see buildZodSchema). Required numerics keep a concrete seed
    // ("" for number inputs, 0 for the rating control) to stay controlled.
    if (f.type === "checkbox") {
      values[f.name] = false;
    } else if (f.type === "rating") {
      values[f.name] = f.required ? 0 : undefined;
    } else if (f.type === "number") {
      values[f.name] = f.required ? "" : undefined;
    } else {
      values[f.name] = "";
    }
  }
  return values;
}
