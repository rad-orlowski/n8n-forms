# lib — core contracts

## schema.ts
The single source of truth for the form/field type system.

- `FieldDef` — per-field config (type, name, label, options, min/max, required, etc.)
- `FormSchema` — full form config (slug, title, webhook, fields, submitLabel, successMessage, `response?`)
- `ResponseField` — `{ key: string; label?: string }` — one field to surface from the webhook reply; `key` is a dot-path
- `ResponseConfig` — `{ title?: string; fields: ResponseField[] }` — the `FormSchema.response` value
- `defineForm(schema)` — identity helper; provides editor autocomplete + type-checking in `*.form.ts` files
- `buildZodSchema(fields)` — derives a `z.object({...})` from a field list; used by `FormShell` via `zodResolver`
- `defaultValues(fields)` — initial RHF values (`""` for text, `false` for checkbox, `0` for rating)
- `FieldComponentProps` — `{ field: ControllerRenderProps, def: FieldDef }` — the props contract every field component must accept
- `FieldComponent` — `ComponentType<FieldComponentProps>`

### Response dot-path resolution
`ResponsePanel` in `FormShell.tsx` resolves each `ResponseField.key` with `get` imported from
**`es-toolkit/compat`** (not the main `es-toolkit` export — `get` does not exist there).
Dot-paths work against both plain objects and top-level arrays; n8n's default webhook echo
returns `[{...}]`, so paths use numeric indices: `"0.body.message"`, `"0.executionMode"`.

## submit.ts
`postToWebhook(url, values, options?)` — POSTs JSON to an n8n webhook via `ky`.

- Returns `SubmitResult: { ok, status, body }`
- `options.headers` is the auth seam (e.g. for bearer tokens)
- **POST retry is intentionally disabled** — retrying a POST can double-trigger an n8n workflow if the first request succeeded but the response was lost
- CORS note: `file://` origin is `null`; n8n Webhook node must allow `*`
- Network/CORS failures return `{ ok: false, status: 0, body: errorMessage }`
