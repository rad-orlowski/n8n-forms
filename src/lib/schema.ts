import type { ComponentType } from "react";
import type { ControllerRenderProps, FieldValues } from "react-hook-form";
import { z } from "zod";

/**
 * Field + form contract shared by the whole system.
 *
 * - A *form* is one file in src/forms/*.form.ts that calls defineForm(...).
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
    | "textarea"
    | "number"
    | "select"
    | "checkbox"
    | "date"
    | "rating"
    | (string & {});
  /** Key sent to the webhook payload. */
  name: string;
  label?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  /** select */
  options?: FieldOption[];
  /** number / rating bounds */
  min?: number;
  max?: number;
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
  /** n8n Production webhook URL this form POSTs to. */
  webhook: string;
  submitLabel?: string;
  /** Shown in the success panel after a 2xx response. */
  successMessage?: string;
  fields: FieldDef[];
  /**
   * Optional: declare which fields from the webhook JSON response to render
   * in the success panel. Omitting this shows only successMessage.
   */
  response?: ResponseConfig;
}

/** Identity helper — gives editor autocomplete + type-checking in each form file. */
export function defineForm(schema: FormSchema): FormSchema {
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

/** Build a Zod validation schema from a form's field list. */
export function buildZodSchema(fields: FieldDef[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const f of fields) {
    let s: z.ZodTypeAny;

    switch (f.type) {
      case "email": {
        const base = z.string().email("Enter a valid email address");
        s = f.required
          ? base.min(1, "This field is required")
          : z.union([z.literal(""), base]).optional();
        break;
      }
      case "number":
      case "rating": {
        let num = z.coerce.number({ invalid_type_error: "Enter a number" });
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

/** Default values keyed by field name, so RHF inputs stay controlled. */
export function defaultValues(fields: FieldDef[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const f of fields) {
    values[f.name] =
      f.type === "checkbox" ? false : f.type === "rating" ? 0 : "";
  }
  return values;
}
