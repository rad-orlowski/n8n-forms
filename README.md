# n8n-forms

A self-contained React form console that POSTs to [n8n](https://n8n.io) webhook triggers. The entire app builds down to **a single portable `forms.html`** that runs from `file://` — no server, no deployment, no dependencies at runtime.

---

## How it works

1. Each form is defined as a TypeScript file (`src/forms/<slug>.form.ts`) that declares fields, validation, and a target webhook URL.
2. `bun run build` + `./bundle-artifact.sh` produces `forms.html` — a fully self-contained file with all CSS, JS, and webhook URLs inlined.
3. Open `forms.html` directly in a browser. Fill out a form, hit Submit. The page POSTs JSON to the n8n webhook and renders the response.

> **Note:** Webhook URLs are baked into the bundle at build time — they are not runtime secrets. Keep `.env` out of git (it is gitignored). Anyone with the HTML file can read the URLs.

---

## Quick start

### Prerequisites

- [Bun](https://bun.sh) — used for everything; do not use npm/pnpm/yarn
- A running n8n instance with at least one Webhook node (see [n8n docs](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.webhook/))

### Setup

```bash
cp .env.example .env          # fill in your webhook URLs
bun install
bun dev                        # dev server at http://localhost:5173
```

### Build the portable artifact

```bash
./bundle-artifact.sh           # outputs forms.html
```

Open `forms.html` in any browser — no server needed.

---

## Project structure

```
.
├── src/
│   ├── forms/              # one *.form.ts per form
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

1. **Create** `src/forms/<slug>.form.ts`:

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

2. **Register** it in `src/forms/index.ts`:

   ```ts
   import myForm from "./my-form.form";
   export const forms: FormSchema[] = [...existingForms, myForm];
   ```

3. **Add the env key** to `.env` and `.env.example`:

   ```
   VITE_WEBHOOK_MY_FORM=https://YOUR-N8N-HOST/webhook/my-form
   ```

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
| `richtext`  | TipTap editor     | sends HTML; debounced ~250 ms, flushes on blur     |

To add a custom field type, see `src/components/fields/CLAUDE.md`.

---

## n8n CORS requirement

When `forms.html` is opened via `file://`, the browser sends `Origin: null`. Every n8n Webhook node must have:

> **Allowed Origins → `*`**

A missing or wrong CORS header shows up as a network error (status 0) in the form's error state.

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
