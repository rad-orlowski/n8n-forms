# Reference

## Field types

Registered in `src/components/fields/index.ts`:

`text`, `email`, `textarea`, `number`, `select`, `checkbox`, `date`, `rating`, `richtext`

- `select` requires an `options` array (`{ label, value }`).
- `number` / `rating` accept optional `min` / `max`.
- `richtext` is the TipTap editor; its value is an HTML string.
- Anything else → add a custom field (see `src/components/fields/CLAUDE.md`).

## n8n configuration (verified gotchas)

- Webhook node method: **POST**
- **Allowed Origins (CORS): `*`** — required because a `file://` page sends a `null`
  origin; without it every request fails silently (status 0)
- **Activate** the workflow before testing — inactive workflows return 404
- Use the **Production** URL, not the Test URL (different paths; the Test URL only works
  while n8n's manual execution panel is listening)
- TLS: if the n8n host uses a self-signed cert the browser blocks the request — use a
  trusted cert, or plain `http://` on a LAN

### Failure diagnosis

| Symptom | Cause |
|---|---|
| status 0 / network error | CORS missing, or TLS cert rejected |
| 404 | Workflow not activated, or Test URL used instead of Production |

## Webhook payload types

The JSON posted to n8n uses each field's `name` as the key. Value types:

| Field type | JSON type |
|---|---|
| text, email, textarea, select | string |
| richtext | HTML string |
| number, rating | number |
| date | string `yyyy-MM-dd` |
| checkbox | boolean |

## Response rendering

Add `response` to a form schema to surface fields from the webhook's JSON reply in the success panel:

```ts
response: {
  title: "Result",          // optional label-tech heading
  fields: [
    { key: "executionId" },
    { key: "data.status", label: "Status" },
  ],
}
```

- `key` is a dot-path (`es-toolkit/compat` `get`); supports nested paths and numeric array indices.
- `label` falls back to the raw key if omitted.
- **n8n's default echo is a top-level array** `[{...}]` — use `"0.fieldName"` dot-index paths (e.g. `"0.body.message"`, `"0.executionMode"`). `ResponsePanel` accepts both plain objects and top-level arrays.
- Non-JSON response bodies render as plain text, truncated to 500 chars (graceful fallback).
- Omitting `response` entirely shows only `successMessage` — no breaking change.
