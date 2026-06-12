import type { FieldComponent } from "@/lib/schema";

import { TextField } from "./text-field";
import { EmailField } from "./email-field";
import { TextareaField } from "./textarea-field";
import { NumberField } from "./number-field";
import { SelectField } from "./select-field";
import { CheckboxField } from "./checkbox-field";
import { DateField } from "./date-field";
import { RatingField } from "./rating-field";
import { RichTextField } from "./rich-text-field";
import { UrlField } from "./url-field";

/**
 * The field registry. Map a field `type` string to the component that renders it.
 * To add a custom element: build it with the FieldComponentProps contract, then
 * add one line here. Nothing else in the system needs to change.
 */
export const FIELD_REGISTRY: Record<string, FieldComponent> = {
  text: TextField,
  email: EmailField,
  url: UrlField,
  textarea: TextareaField,
  number: NumberField,
  select: SelectField,
  checkbox: CheckboxField,
  date: DateField,
  rating: RatingField,
  richtext: RichTextField, // custom: TipTap simple editor (built by tiptap-eng)
};
