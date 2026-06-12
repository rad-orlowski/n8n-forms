# n8n-forms

[![CI](https://github.com/rad-orlowski/n8n-forms/actions/workflows/ci.yml/badge.svg)](https://github.com/rad-orlowski/n8n-forms/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Built with Bun](https://img.shields.io/badge/built%20with-bun-000000?logo=bun&logoColor=white)](https://bun.sh)

A self-contained React form console that POSTs to [n8n](https://n8n.io) webhook triggers. The entire app builds down to **a single portable `forms.html`** that runs from `file://` — no server, no deployment, no dependencies at runtime.

<p align="center">
  <img src="docs/images/grid.png" alt="Form console home — a dark, amber-accented grid of available forms" width="820">
</p>

---

## How it works

1. Each form is defined as a TypeScript file (`forms/<slug>.form.ts`) that declares fields, validation, and a target webhook URL.
2. `bun run build` + `./bundle-artifact.sh` produces `forms.html` — a fully self-contained file with all CSS, JS, and webhook URLs inlined.
3. Open `forms.html` directly in a browser. Fill out a form, hit Submit. The page POSTs JSON to the n8n webhook and renders the response.

> **Note:** Webhook URLs are baked into the bundle at build time — they are not runtime secrets. Keep `.env` out of git (it is gitignored). Anyone with the HTML file can read the URLs.

## Screenshots

| Filling out a form | Rich-text field |
|---|---|
| [![A contact form with name, email, topic, and message fields filled in](docs/images/contact.png)](docs/images/contact.png) | [![A feedback form showing the TipTap rich-text editor with a bulleted list and bold text](docs/images/feedback.png)](docs/images/feedback.png) |

> The forms above ship as runnable examples in [`forms/examples/`](forms/examples) — copy one as a starting point for your own.

---

> **WARNING: `forms.html` contains your secrets.** The built file has every webhook URL
> inlined in plaintext — treat it exactly like a `.env` file or private key. Never commit
> it to git (it is gitignored), never share it via email, Slack, or public URLs, and
> distribute it only to trusted recipients via secure channels. If it is compromised,
> rebuild with new webhook URLs.

---

## Quick start

### Prerequisites

- [Bun](https://bun.sh) — **required**. This project does not support npm, yarn, or pnpm.
  Use `bun` for every command shown below.
- A running n8n instance with at least one Webhook node (see [n8n docs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/))

### Setup

```bash
cp .env.example .env          # fill in your webhook URLs
bun install
bun dev                        # dev server at http://localhost:5173
```

### Build the portable artifact

Two commands are involved in producing the final file:

| Command | What it does | Output |
|---|---|---|
| `bun run build` | Vite build only | `dist/` directory |
| `./bundle-artifact.sh` | Full pipeline: build → patch → inline | Single portable `forms.html` |

For day-to-day distribution use `./bundle-artifact.sh`. `bun run build` alone is useful if
you only need the `dist/` output (e.g. for further scripting).

Open `forms.html` in any browser — no server needed.

---

## Project structure

```
.
├── forms/                  # one *.form.ts per form (auto-discovered, recursively)
│   └── examples/           # runnable example forms (contact, feedback, event-rsvp)
├── src/
│   ├── components/
│   │   ├── FormShell.tsx   # main template (RHF + zod + submit + response)
│   │   ├── fields/         # field components + FIELD_REGISTRY
│   │   ├── tiptap-*/       # vendored TipTap simple editor (rich-text field)
│   │   └── ui/             # shadcn/ui primitives
│   ├── lib/
│   │   ├── schema.ts       # FieldDef, FormSchema, defineForm(), buildZodSchema()
│   │   └── submit.ts       # postToWebhook() via ky (no retry — avoids double-triggers)
│   └── index.css           # "industrial control panel" dark theme (charcoal/amber)
├── .env.example            # webhook URL template — copy to .env and fill in
├── bundle-artifact.sh      # build → patch → inline → forms.html
└── forms.html              # ⚠ build artifact, gitignored
docs/
└── tiptap-simple-template.md
```

---

## Adding a form

The app auto-discovers every `*.form.ts` under the `forms/` directory (including
subfolders like `forms/examples/`) via `import.meta.glob` — no manual registration
is needed. Just create the file, add the env key, and restart `bun dev`.

1. **Create** `forms/<slug>.form.ts`:

   ```ts
   import { defineForm } from "@/lib/schema";

   export default defineForm({
     slug: "my-form",
     title: "My Form",
     webhook: import.meta.env.VITE_WEBHOOK_MY_FORM,
     submitLabel: "Send",
     successMessage: "Done!",
     fields: [
       { type: "text",  name: "name",    label: "Your name", required: true },
       { type: "email", name: "email",   label: "Email",     required: true },
       { type: "textarea", name: "body", label: "Message" },
     ],
   });
   ```

2. **Add the env key** to `.env` and `.env.example`:

   ```
   VITE_WEBHOOK_MY_FORM=https://YOUR-N8N-HOST/webhook/my-form
   ```

The full form schema is the source of truth in [`src/lib/schema.ts`](src/lib/schema.ts)
(`FieldDef`, `FormSchema`, `ResponseConfig`). See [`forms/ping.form.ts`](forms/ping.form.ts)
for a minimal working example, or [`forms/examples/`](forms/examples) for fuller forms
that exercise selects, ratings, dates, and the rich-text field.

### Rendering the webhook response

Add a `response` key to display fields from the n8n workflow's JSON reply:

```ts
response: {
  title: "Result",
  fields: [
    { key: "0.executionId" },              // n8n default echo wraps reply in an array
    { key: "0.data.status", label: "Status" },
  ],
},
```

Keys are dot-paths resolved via `es-toolkit/compat` `get`. n8n's default echo shape is `[{ ...body }]`, so prefix paths with `0.`.

---

## Available field types

| `type`      | Component         | Notes                                              |
|-------------|-------------------|----------------------------------------------------|
| `text`      | `<Input>`         |                                                    |
| `email`     | `<Input type=email>` |                                                 |
| `textarea`  | `<Textarea>`      |                                                    |
| `number`    | `<Input type=number>` | supports `min` / `max`                        |
| `select`    | shadcn `<Select>` | requires `options: [{label, value}]`               |
| `checkbox`  | shadcn `<Checkbox>` | sends boolean                                    |
| `date`      | shadcn `<Calendar>` | sends ISO date string                            |
| `rating`    | Star rating       | `max` defaults to 5, sends number                  |
| `richtext`  | TipTap editor     | sends HTML; debounced ~250 ms, flushes on blur — **see note below** |

> **Rich-text field — HTML output:** The `richtext` field submits TipTap's HTML to the
> webhook. The form renders response data as plain text only (no `dangerouslySetInnerHTML`),
> so the app itself is safe. However, the receiving n8n workflow is responsible for
> sanitizing this HTML before storing it in a database or rendering it in any other web
> context.

To add a custom field type: build a component accepting `{ field, def }: FieldComponentProps`,
then register it in `FIELD_REGISTRY` in [`src/components/fields/index.ts`](src/components/fields/index.ts).
Use the new `type` string in any `*.form.ts`.

---

## n8n CORS requirement

When `forms.html` is opened via `file://`, the browser sends `Origin: null`. Every n8n Webhook node must have:

> **Allowed Origins → `*`**

A missing or wrong CORS header shows up as a network error (status 0) in the form's error state.

### CORS & security implications

Setting `Allowed Origins: *` is a required trade-off for the `file://` design, but it means
**any website can POST arbitrary JSON to your webhook** — not just your form. Potential risks:

- Spam and garbage submissions from malicious sites
- Cost escalation if your n8n instance charges per execution
- Data poisoning if the workflow writes submissions to a database without validation

**Mitigations — implement these in your n8n workflow:**

1. **Keep webhook URLs secret** — treat them like API keys; never publish or share them
2. **Validate the request payload** — check required fields, expected shapes, and domain-specific constraints at the start of every workflow
3. **Rate-limit by IP or session** — add a rate-limit node before any expensive operations
4. **Monitor for abuse** — log all submissions and alert on sudden spikes or repeated failures
5. **IP whitelisting** (if feasible) — if forms are used only on known networks, restrict access at the firewall or n8n level

The n8n webhook itself cannot enforce origin-specific CORS because of the `file://` null-origin
constraint. All security enforcement must happen inside the workflow.

### Idempotency and POST retry

The form client intentionally does not retry failed POST requests (see `src/lib/submit.ts`).
This avoids double-triggering workflows when a submission is ambiguous (e.g., a timeout where
the server may have already processed the request). If your workflow must be idempotent
(e.g., it inserts a unique record), implement server-side deduplication in n8n — for example,
by storing a client-generated submission ID and checking it before processing.

---

## Commands

| Command | Description |
|---|---|
| `bun dev` | Dev server at `http://localhost:5173` |
| `bun run build` | Vite build → `dist/` |
| `bun run lint` | ESLint |
| `./bundle-artifact.sh` | Full pipeline: build → patch → inline → `forms.html` |

---

## Tech stack

- **React 19** + **TypeScript** + **Vite**
- **React Hook Form** + **Zod** — form state and validation
- **shadcn/ui** + **Tailwind CSS** — UI primitives
- **TipTap** (vendored simple editor) — rich-text field
- **ky** — HTTP client for webhook POSTs
- **es-toolkit** — `debounce` (TipTap field) + `get` (response dot-path resolution)
- **Bun** — package manager and runtime
