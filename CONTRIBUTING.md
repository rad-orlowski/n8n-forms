# Contributing to n8n-forms

Thanks for your interest! This is a small, self-contained React app that builds
to a single portable `forms.html`. Contributions are welcome.

## Ground rules

- **Never commit secrets.** No real webhook URLs, tokens, or `.env` contents.
  Always reference webhooks via `import.meta.env.VITE_WEBHOOK_<KEY>`. The built
  `forms.html` and your `.env` are gitignored — keep it that way.
- **Use Bun, not npm/yarn/pnpm.** All commands and the lockfile assume `bun`.

## Getting started

```bash
bun install
cp .env.example .env   # fill in your own n8n webhook URLs
bun dev                # dev server at http://localhost:5173
```

Forms are routed by URL hash: `http://localhost:5173/#/<slug>` (e.g. `/#/ping`).

## Build commands

```bash
bun run lint           # eslint
bun run build          # tsc -b && vite build → dist/  (typechecks too)
./bundle-artifact.sh   # full pipeline → single portable forms.html
```

CI runs `bun run lint` and `bun run build` on every PR — please make sure both
pass locally first.

## Adding a form

1. Create `forms/<slug>.form.ts` exporting `defineForm({ ... })`.
2. Set `webhook: import.meta.env.VITE_WEBHOOK_<YOUR_KEY>` and add the key to
   both `.env` and `.env.example` (use a placeholder value in `.env.example`).

The app auto-discovers every top-level `forms/*.form.ts` via `import.meta.glob`
— there is **no** manual registration step.

The form schema is defined in `src/lib/schema.ts`; `forms/ping.form.ts` is a minimal
working example.

## Adding a field type

1. Build a React component accepting `{ field, def }: FieldComponentProps`.
2. Add one entry to `FIELD_REGISTRY` in `src/components/fields/index.ts`.
3. Use the new `type` string in any `*.form.ts`.

The `FieldComponentProps` contract lives in `src/lib/schema.ts`; existing field
components in `src/components/fields/` are the best reference.

## Pull requests

- Keep changes focused; one logical change per PR.
- Fill in the PR template checklist.
- Update `README.md` if you change behavior or setup.

## Security

Found a vulnerability? Please follow [`SECURITY.md`](./SECURITY.md) — don't open
a public issue.
