import type { ComponentType } from "react";
import type { ControllerRenderProps, FieldValues } from "react-hook-form";
import type { LucideIcon } from "lucide-react";
import { z } from "zod";

/**
 * Field + form contract shared by the whole system.
 *
 * - A *form* is one file in forms/*.form.ts that calls defineForm(...).
 * - A *field* is rendered by a component registered in src/components/fields/index.ts
 *   keyed by `type`. Add a new `type` string + component there to extend the system;
 *   no other file needs to change.
 */

export interface FieldOption {
  label: string;
  value: string;
}

export interface FieldDef {
  /** Maps to a component in the field registry. Built-ins below; custom types allowed. */
  type:
    | "text"
    | "email"
    | "url"
    | "textarea"
    | "number"
    | "select"
    | "checkbox"
    | "date"
    | "rating"
    | "richtext"
    // ── static display-only ──────────────────────────────────────────────
    | "heading"
    | "description"
    | "image"
    | "alert"
    | (string & {});
  /**
   * Key sent to the webhook payload.
   * Required for input fields; omit for static display fields
   * (`heading`, `description`, `image`, `alert`).
   */
  name?: string;
  label?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  /** select — static options (used when optionsFrom is absent, or on page 0) */
  options?: FieldOption[];
  /**
   * Dynamic options binding — dot-path into the step data returned by n8n
   * (e.g. "options" resolves to an array shaped `[{label, value}]`).
   * Only allowed on page index ≥ 1 (pages after the initial submit).
   */
  optionsFrom?: string;
  /**
   * Dynamic value prefill — dot-path into step data that pre-populates this
   * field's value. Only allowed on page index ≥ 1.
   */
  valueFrom?: string;
  /** number / rating bounds */
  min?: number;
  max?: number;
  // ── static field props ──────────────────────────────────────────────────
  /** Primary body text for `description` and `alert` fields. */
  content?: string;
  /** Image URL (or data URI) for `image` fields. */
  src?: string;
  /** Alert colour scheme. Defaults to "info". */
  variant?: "info" | "warning" | "danger" | "success";
  /** Heading level for `heading` fields. Defaults to 2. */
  level?: 2 | 3;
}

/**
 * One step (page) in a multi-page form.
 * `fields` is the active field list for that page.
 */
export interface PageDef {
  /** Optional stable identifier (used for analytics / SSE step tracking). */
  id?: string;
  /** Page-level title shown above the fields. */
  title?: string;
  /** Page-level description shown below the title. */
  description?: string;
  /**
   * When true, a "Retry" button is shown on this page's error panel instead of
   * "Start over". Use for idempotent pages where re-submitting the same answers
   * is safe. Defaults to false (errors require restarting the session).
   */
  retryable?: boolean;
  fields: FieldDef[];
}

/**
 * Declares one field to surface from the webhook's JSON response body.
 * `key` is a dot-path into the parsed JSON (e.g. "executionId" or "data.id").
 * `label` is optional display text; falls back to the raw key.
 */
export interface ResponseField {
  /** Dot-path into the parsed JSON reply, e.g. "id" or "data.ticket". */
  key: string;
  /** Display label — defaults to a humanized key if omitted. */
  label?: string;
  /**
   * Rendering hint:
   * - `"heading"` — large prominent text, shown full-width (good for titles)
   * - `"tags"` — renders array (or comma-separated string) as inline chips
   * Arrays are auto-detected as tags even without this flag.
   */
  format?: "heading" | "tags";
  /**
   * When set, renders a labelled divider before this field — useful for
   * grouping related rows visually (e.g. "Compensation", "Requirements").
   */
  section?: string;
  /**
   * When `true`, the row is omitted entirely if the resolved value is empty
   * (null, undefined, empty string, or empty array).
   * Default (`false`/omitted) shows "—" so the field is visibly absent.
   */
  hideIfEmpty?: boolean;
}

/**
 * Optional config for rendering structured data from the webhook response.
 * When present, the success panel parses the response body as JSON and
 * displays each declared field. Non-JSON responses fall back to plain text.
 */
export interface ResponseConfig {
  /** Heading shown above the response fields. Defaults to "Response". */
  title?: string;
  fields: ResponseField[];
}

export interface FormSchema {
  /** URL hash route + identity, e.g. "contact" -> #/contact */
  slug: string;
  title: string;
  description?: string;
  /** Optional lucide-react icon component shown in the card and form header. */
  icon?: LucideIcon;
  /**
   * Ordered list of pages. Page 0 is the initial page — the form POSTs to
   * `/api/forms/:slug/start` when the user submits page 0. Each subsequent
   * page resumes the n8n execution via `/api/sessions/:id/step`.
   *
   * Dynamic fields (`optionsFrom` / `valueFrom`) are only permitted on pages
   * at index ≥ 1, because no n8n data exists until after the first submit.
   */
  pages: PageDef[];
  submitLabel?: string;
  /** Shown in the success panel after a 2xx response. */
  successMessage?: string;
  /**
   * Optional: declare which fields from the webhook JSON response to render
   * in the success panel. Omitting this shows only successMessage.
   */
  response?: ResponseConfig;
}

/**
 * Identity helper — gives editor autocomplete + type-checking in each form file.
 * Also validates that dynamic fields (`optionsFrom` / `valueFrom`) are not placed
 * on page 0, where no n8n step data exists yet.
 *
 * Throws at module load time with a clear diagnostic if the rule is violated.
 */
export function defineForm(schema: FormSchema): FormSchema {
  for (const field of schema.pages[0]?.fields ?? []) {
    if (field.optionsFrom != null) {
      throw new Error(
        `[${schema.slug}] field "${field.name ?? field.type}" uses optionsFrom on page 0 — ` +
          "dynamic fields require page index ≥ 1 (no n8n data exists before the first submit)."
      );
    }
    if (field.valueFrom != null) {
      throw new Error(
        `[${schema.slug}] field "${field.name ?? field.type}" uses valueFrom on page 0 — ` +
          "dynamic fields require page index ≥ 1 (no n8n data exists before the first submit)."
      );
    }
  }
  return schema;
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
        s = f.required ? num : num.optional();
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
        s = f.required ? base.min(1, "This field is required") : base.optional();
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
    values[f.name] =
      f.type === "checkbox" ? false : f.type === "rating" ? 0 : "";
  }
  return values;
}
