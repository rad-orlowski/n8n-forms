# Forms — authoring guide

Drop a `<slug>.form.ts` file here. The app auto-discovers every `*.form.ts` in this directory — **no registration step, no index.ts edit**.

## Adding a form

```ts
// forms/my-form.form.ts
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

Then add the env key to `.env` and `.env.example`:
```
VITE_WEBHOOK_MY_FORM=https://YOUR-N8N-HOST/webhook/my-form
```

Run `bun dev` or `bun run build` — done.

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
    title: "Execution result",       // optional heading
    fields: [
      { key: "executionId" },        // dot-path into the parsed JSON
      { key: "data.status", label: "Status" },
    ],
  },
});
```

- `key` is a dot-path resolved via `es-toolkit/compat` `get` (e.g. `"data.id"`, `"body.message"`).
- `label` is optional; falls back to the raw key string.
- The n8n reply may be a bare object `{...}` or array-wrapped `[{...}]` — both are handled automatically.
- Omitting `response` shows only `successMessage`.

## Env key convention
`VITE_WEBHOOK_<SLUG_SCREAMING_SNAKE>` — the form's `slug` converted to `SCREAMING_SNAKE_CASE`.
Vite inlines these at build time; they are **not** runtime secrets. Keep real URLs out of git
by setting them only in a local `.env` file (gitignored).
