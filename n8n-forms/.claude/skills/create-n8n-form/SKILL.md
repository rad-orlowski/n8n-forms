---
name: create-n8n-form
description: Create a new form that triggers an n8n workflow via webhook. Use when adding an n8n form, new webhook form, or scaffolding a form in the n8n-forms app.
---

# create-n8n-form

Add a form to `/Users/rad/dev/playground/n8n forms/n8n-forms`. Repo references:
`src/forms/CLAUDE.md` (schema), `src/components/fields/CLAUDE.md` (fields), root `CLAUDE.md` (build).

## When to use
- Adding or scaffolding a new form that POSTs to an n8n webhook in this app.

## Steps
1. Gather: title/purpose, kebab-case `slug`, fields (name/type/label/required; options for `select`), and the n8n **Production** webhook URL. Available field types → [reference.md](reference.md).
2. Create `src/forms/<slug>.form.ts` with `defineForm(...)` and `webhook: import.meta.env.VITE_WEBHOOK_<SLUG_UPPER>`. Template + `SLUG_UPPER` rule → [examples.md](examples.md).
3. Register it in `src/forms/index.ts` (import + add to the `forms` array). Snippet → [examples.md](examples.md).
4. Wire the env key in 3 places — `.env` (real URL), `.env.example` (placeholder), `src/vite-env.d.ts` (declaration). Snippets → [examples.md](examples.md).
5. *(Optional)* Declare a `response` config to render fields from the webhook's JSON reply in the success panel. n8n's default echo is a top-level array — use dot-index paths. Example + array note → [examples.md](examples.md); gotchas → [reference.md](reference.md).
6. Missing field type? Add a custom one per `src/components/fields/CLAUDE.md`.
7. Configure n8n: Webhook = POST, **Allowed Origins `*`**, activate the workflow, use the Production URL. Gotchas + failure table → [reference.md](reference.md).
8. Build: `./bundle-artifact.sh` → `forms.html` (env values inlined at build time; the file is gitignored).
9. Test: open `forms.html` → `#/<slug>` → submit → check n8n **Executions**. Payload types → [reference.md](reference.md).
