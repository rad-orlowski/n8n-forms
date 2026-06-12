# n8n workflow contract

This document describes what each n8n workflow connected to n8n-forms must do.
It is the integration contract between the BFF and the n8n side.

---

## Overview

The BFF proxies browser submissions to n8n and threads the per-execution
`resumeUrl` as opaque server-side state. The browser never sees webhook URLs
or `resumeUrl` values — it only talks to `/api/*`.

Per-session flow:

```text
Page 0 submit → POST /api/forms/:slug/start
  → BFF POSTs WEBHOOK_<SLUG> with { answers, sessionId, callbackUrl }
  → n8n reply: 2xx+body (sync) or 202 (async)

Page N submit → POST /api/sessions/:id/step
  → BFF POSTs stored resumeUrl with { answers, sessionId, callbackUrl }
  → same sync-or-202 handling
```

---

## What the BFF sends to n8n

Every call (start and step) sends a JSON body:

```json
{
  "answers": { "<fieldName>": "<value>", ... },
  "sessionId": "<uuid>",
  "callbackUrl": "https://<PUBLIC_BASE_URL>/api/callback/<sessionId>"
}
```

- `answers` — the submitted field values for the current page
- `sessionId` — opaque session identifier; must be echoed back in async callbacks
- `callbackUrl` — the BFF endpoint n8n must POST to for async (202) steps

---

## Reply options

### Synchronous reply (body)

Return any 2xx status with a JSON body:

```json
{
  "data": { ... },
  "resumeUrl": "<$execution.resumeUrl>",
  "done": false
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `data` | No | Arbitrary object passed to the next page's `optionsFrom`/`valueFrom` bindings |
| `resumeUrl` | Yes (unless `done: true`) | The n8n Wait-node resume URL for the next step — stored server-side, never forwarded to browser |
| `done` | No (default `false`) | Set `true` on the final step; BFF marks the session complete and renders the `response` panel |

The `resumeUrl` field is the value of `$execution.resumeUrl` from n8n's expression
language, set in a **Wait node** configured with **Respond = "When Last Node Finishes"**
or a **Respond to Webhook** node.

### Asynchronous reply (202)

Return `HTTP 202 No Content` to indicate the step will complete later.

The browser opens `GET /api/sessions/:id/events` (SSE) and waits. When the step
is ready, n8n makes an outbound HTTP POST to the `callbackUrl` with the same
body shape as the synchronous reply:

```json
{
  "data": { ... },
  "resumeUrl": "<$execution.resumeUrl>",
  "done": false,
  "sessionId": "<the sessionId from the original request>"
}
```

The BFF relays this to the waiting SSE stream and stores it in SQLite for replay
if the browser reconnects before the event is consumed.

**`sessionId` echo is required** — the BFF uses it to route the callback to the
correct SSE subscriber. If it is absent the callback is dropped.

---

## `data` shape and dynamic field bindings

The `data` object returned by n8n is made available to the *next* page's fields
via dot-path bindings in the form schema:

```ts
// forms/my-form.form.ts
pages: [
  { fields: [/* page 0 — no dynamic bindings */] },
  {
    fields: [
      {
        type: "select",
        name: "category",
        label: "Category",
        optionsFrom: "categories",   // resolved from data.categories
      },
      {
        type: "text",
        name: "ref",
        label: "Reference",
        valueFrom: "defaultRef",     // prefill from data.defaultRef
      },
    ],
  },
],
```

**`optionsFrom`** — dot-path into `data` that resolves to an array of
`{ label: string; value: string }` objects:

```json
{
  "categories": [
    { "label": "Bug", "value": "bug" },
    { "label": "Feature", "value": "feature" }
  ]
}
```

**`valueFrom`** — dot-path into `data` that resolves to a scalar used as the
field's initial value:

```json
{
  "defaultRef": "PROJ-42"
}
```

Both bindings use `es-toolkit/compat` `get()` for resolution, so nested paths
work (e.g. `"meta.options"`, `"user.email"`).

Dynamic bindings are only valid on pages at index ≥ 1. `defineForm()` will throw
at module load time if they are placed on page 0 (no n8n data exists before the
first submit).

---

## Reporting a business error

If the workflow completed successfully at the HTTP level but the result is an
error (e.g. "User already exists", "Validation failed"), include `__error: true`
in the reply body:

```json
{
  "__error": true,
  "message": "A user with that email already exists."
}
```

This works in both the **synchronous** and **async callback** reply paths.

| Field | Required | Notes |
| --- | --- | --- |
| `__error` | Yes | Must be the boolean `true` |
| `message` | Recommended | Shown verbatim in the form's error panel; defaults to "The workflow reported an error." if absent |

The BFF detects this sentinel before forwarding to the browser:

- **Sync path** — the route returns `HTTP 422` with `{ "error": "<message>" }`.
  The browser's existing BFF-error handler catches it and transitions to the
  error panel.
- **Async / callback path** — the BFF relays the error through the SSE stream.
  The browser's SSE handler transitions to the error panel.

The `__error` and `message` keys are **never** forwarded as `data` — they are
stripped by the BFF.

---

## Done signal

The workflow signals completion by setting `"done": true` (or by omitting
`resumeUrl`) in either the synchronous body or the async callback body.

When the BFF receives a done signal:

1. The session is marked complete in SQLite.
2. The SSE stream is closed.
3. The browser renders the `response` panel using the `data` from the final step.

---

## Example: two-page synchronous wizard

```text
Trigger Webhook
  ↓
(process page-0 answers)
  ↓
Respond to Webhook
  body: {
    "data": {
      "categories": [{"label": "A", "value": "a"}, {"label": "B", "value": "b"}]
    },
    "resumeUrl": "{{ $execution.resumeUrl }}",
    "done": false
  }
  ↓
Wait node ("On Webhook Call")
  (receives page-1 answers via resumeUrl POST)
  ↓
(finalize)
  ↓
Respond to Webhook
  body: {
    "data": { "ticketId": "PROJ-99" },
    "done": true
  }
```

## Example: async step (202 + callback)

```text
Trigger Webhook
  → reply 202 immediately
  ↓
(long-running processing…)
  ↓
HTTP Request node → POST {{ $json.callbackUrl }}
  body: {
    "sessionId": "{{ $json.sessionId }}",
    "data": { "result": "ok" },
    "resumeUrl": "{{ $execution.resumeUrl }}",
    "done": false
  }
  ↓
Wait node ("On Webhook Call")
  …
```

---

## Security notes

- Webhook URLs (`WEBHOOK_<SLUG>`) and `resumeUrl` values are stored
  server-side only and never appear in BFF responses to the browser.
- The `callbackUrl` embeds the `sessionId` — n8n must not share or forward it.
- Implement payload validation inside each n8n workflow; the BFF forwards answers
  without sanitization.
