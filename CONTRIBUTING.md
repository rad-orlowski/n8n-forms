# Contributing to n8n-forms

Thanks for your interest! n8n-forms is a React SPA backed by a Hono/Bun BFF
server. Contributions are welcome.

## Ground rules

- **Never commit secrets.** No real webhook URLs or `.env` contents — ever.
  Webhook URLs live server-side in `.env` (gitignored). The source code and
  `forms/*.form.json5` definitions are safe to publish.
- **Use Bun, not npm/yarn/pnpm.** All commands and the lockfile assume `bun`.

## Getting started

```bash
bun install
cp .env.example .env   # fill in your own n8n webhook URLs
bun dev                # full-stack dev server at http://localhost:3737 (BFF + Vite HMR)
```

Forms are routed by URL hash: `http://localhost:3737/#/<slug>` (e.g. `/#/ping`).

## Build commands

```bash
bun run lint           # ESLint
bun run build          # tsc -b && vite build → dist/
bun run test           # full test suite (Vitest + bun test)
bun start              # serve built dist/ + /api/* via the BFF
```

CI runs lint, build, and tests on every PR — please make sure all three pass
locally before opening one.

## Adding a form

1. Create `forms/<slug>.form.json5`:

   ```json5
   // $schema: ./form.schema.json
   {
     slug: "my-form",
     title: "My Form",
     pages: [{ fields: [{ type: "text", name: "message", label: "Message" }] }],
   }
   ```

2. Add `WEBHOOK_<SLUG>` to both `.env` and `.env.example`
   (use a placeholder value in `.env.example`).

The BFF loader discovers forms at runtime; the SPA fetches them via
`GET /api/forms` — there is **no** manual registration step and no build-time
glob. `.form.yaml` / `.form.yml` are also supported.

The full schema is in `src/lib/schema.ts`; `forms/examples/ping.form.json5`
is a minimal working example.

## Adding a field type

1. Build a React component accepting `{ field, def }: FieldComponentProps`.
2. Add one entry to `FIELD_REGISTRY` in `src/components/fields/index.ts`.
3. Use the new `type` string in any `*.form.json5`.

The `FieldComponentProps` contract lives in `src/lib/schema.ts`; existing field
components in `src/components/fields/` are the best reference. See
`src/components/fields/CLAUDE.md` for the full step-by-step guide.

## Pull requests

- Keep changes focused; one logical change per PR.
- Fill in the PR template checklist.
- Update `README.md` if you change behaviour or setup.

## Security

Found a vulnerability? Please follow [`SECURITY.md`](./SECURITY.md) — don't open
a public issue.
