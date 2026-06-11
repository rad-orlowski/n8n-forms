# Forms — authoring guide

Each file in this directory defines one form. The file name convention is `<slug>.form.ts`.

## Adding a form

```ts
// src/forms/my-form.form.ts
import { defineForm } from "@/lib/schema";

export default defineForm({
  slug: "my-form",                            // URL hash: #/my-form
  title: "My Form",
  description: "Optional subtitle shown under the title.",
  webhook: import.meta.env.VITE_WEBHOOK_MY_FORM,
  submitLabel: "Send",                        // default: "Submit"
  successMessage: "Thanks!",                  // shown after 2xx response
  fields: [ /* see FieldDef below */ ],
});
```

Then register it in `index.ts`:
```ts
import myForm from "./my-form.form";
export const forms: FormSchema[] = [...existingForms, myForm];
```

And add the env key to `.env` and `.env.example`:
```
VITE_WEBHOOK_MY_FORM=https://YOUR-N8N-HOST/webhook/my-form
```

## FieldDef shape

```ts
{
  type: "text" | "email" | "textarea" | "number" | "select" | "checkbox" | "date" | "rating" | string
  name: string          // key sent in the webhook JSON payload
  label?: string
  description?: string
  placeholder?: string
  required?: boolean
  options?: { label: string; value: string }[]   // select only
  min?: number                                    // number / rating
  max?: number                                    // number / rating (rating default max: 5)
}
```

## Webhook payload
Values are POSTed as JSON keyed by `name`. Types: most fields are strings; `checkbox` is
boolean; `number`/`rating` are numbers (coerced via zod). `richtext` sends HTML.

## Rendering the webhook response

Add an optional `response` key to surface fields from the n8n workflow's JSON reply:

```ts
export default defineForm({
  // ...
  response: {
    title: "Execution result",       // optional heading (label-tech style)
    fields: [
      { key: "executionId" },        // dot-path into the parsed JSON
      { key: "data.status", label: "Status" },
    ],
  },
});
```

- `key` is a dot-path resolved with `es-toolkit/compat` `get` (e.g. `"data.id"`, `"0.body.message"`).
- `label` is optional; falls back to the raw key string.
- **n8n default echo returns a top-level array** `[{...}]` — use numeric dot-index paths like `"0.body.message"`, `"0.executionMode"`. `ResponsePanel` accepts top-level arrays; it does NOT fall back to raw `<pre>` for them.
- Non-JSON responses (plain text, HTML error pages) fall back to showing the raw body truncated to 500 chars.
- Omitting `response` entirely shows only `successMessage` — fully back-compat.

## Env key convention
`VITE_WEBHOOK_<SLUG_SCREAMING_SNAKE>` — match the form's `slug` converted to
`SCREAMING_SNAKE_CASE`. Vite inlines these at build time; they are NOT runtime secrets.
