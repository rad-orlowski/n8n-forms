import type { ComponentType } from "react";
import type { FieldComponent, FieldDef } from "@/lib/schema";

import { TextField } from "./text-field";
import { EmailField } from "./email-field";
import { TextareaField } from "./textarea-field";
import { NumberField } from "./number-field";
import { SelectField } from "./select-field";
import { CheckboxField } from "./checkbox-field";
import { DateField } from "./date-field";
import { RatingField } from "./rating-field";
import { RichTextField } from "./rich-text-field";
import { SegmentedField } from "./segmented-field";
import { UrlField } from "./url-field";
import { HeadingField } from "./heading-field";
import { DescriptionField } from "./description-field";
import { ImageField } from "./image-field";
import { AlertField } from "./alert-field";

/**
 * Input field registry — each entry receives `{ field, def }` from RHF's
 * Controller render prop. To add a custom input type: build the component with
 * the FieldComponentProps contract, then add one line here.
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
  segmented: SegmentedField,
};

/**
 * Static (display-only) field registry — components receive only `{ def }`.
 * They are not registered with RHF and produce no payload value.
 * To add a custom static type: build the component and add one line here.
 */
export const STATIC_FIELD_REGISTRY: Record<
  string,
  ComponentType<{ def: FieldDef }>
> = {
  heading: HeadingField,
  description: DescriptionField,
  image: ImageField,
  alert: AlertField,
};
