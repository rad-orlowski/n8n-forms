# Examples

Worked snippets for `create-n8n-form`. See also `src/forms/contact.form.ts` and
`src/forms/ping.form.ts` in the repo.

`SLUG_UPPER` = the slug in `SCREAMING_SNAKE_CASE` (hyphens → underscores, uppercased).
e.g. slug `weekly-review` → `VITE_WEBHOOK_WEEKLY_REVIEW`.

## Step 2 — `src/forms/<slug>.form.ts`

```ts
import { defineForm } from "@/lib/schema";

export default defineForm({
  slug: "<slug>",
  title: "<Title>",
  description: "<purpose>",
  webhook: import.meta.env.VITE_WEBHOOK_<SLUG_UPPER>,
  submitLabel: "Submit",
  successMessage: "Submitted — check the n8n execution log.",
  fields: [
    { type: "text", name: "example", label: "Example", required: true },
    // select needs options:
    // { type: "select", name: "kind", label: "Kind",
    //   options: [{ label: "A", value: "a" }, { label: "B", value: "b" }] },
  ],
});
```

## Step 3 — register in `src/forms/index.ts`

```ts
import myForm from "./<slug>.form";
// add to the existing array (currently [ping, contact, bugReport]):
export const forms: FormSchema[] = [ping, contact, bugReport, myForm];
```

## Step 2b — optional `response` config

Add to the `defineForm({...})` call to render fields from the webhook's JSON reply:

```ts
response: {
  title: "Webhook echo",          // optional heading
  fields: [
    { key: "status", label: "Status" },          // plain object: top-level key
    { key: "data.ticket", label: "Ticket" },     // nested dot-path
    // n8n default echo returns a TOP-LEVEL ARRAY [{...}] — use numeric dot-index:
    { key: "0.body.message", label: "Message received" },
    { key: "0.executionMode", label: "Execution mode" },
  ],
},
```

- `key` is resolved with `es-toolkit/compat` `get()` — supports dot-paths and array indices.
- n8n's default "Respond to Webhook" echo wraps the payload in `[{...}]`; use `"0.fieldName"` paths.
- See `src/forms/ping.form.ts` for a worked example using the echo array.
- Omitting `response` entirely is fine — shows only `successMessage`.

## Step 4 — env wiring (3 places)

`.env` (real URL, gitignored — create if missing):
```
VITE_WEBHOOK_<SLUG_UPPER>=https://<your-n8n-host>/webhook/<slug>
```

`.env.example` (placeholder, tracked in git):
```
VITE_WEBHOOK_<SLUG_UPPER>=https://YOUR-N8N-HOST/webhook/<slug>
```

`src/vite-env.d.ts` — add inside `ImportMetaEnv`:
```ts
readonly VITE_WEBHOOK_<SLUG_UPPER>: string;
```
