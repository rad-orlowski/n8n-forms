<!-- Thanks for contributing to n8n-forms! Keep this short. -->

## What & why
<!-- What does this change, and why? Link any related issue. -->

## How I tested
<!-- e.g. `bun dev`, exercised the form at /#/<slug>, or built forms.html and opened it from file:// -->

## Checklist
- [ ] No secrets committed — no real webhook URLs, tokens, or `.env` contents (only `import.meta.env.VITE_WEBHOOK_*` references)
- [ ] `bun run lint` passes
- [ ] `bun run build` succeeds
- [ ] New forms use `import.meta.env.VITE_WEBHOOK_<KEY>` and add the key to `.env.example`
- [ ] Docs updated if behavior or setup changed
