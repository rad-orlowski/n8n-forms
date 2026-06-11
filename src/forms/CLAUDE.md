# src/forms — internal shim

Form *definitions* live in the top-level `forms/` directory, not here.
See [`forms/CLAUDE.md`](../../forms/CLAUDE.md) for the authoring guide.

## What this directory does

`index.ts` is the only file here. It uses `import.meta.glob` to auto-discover
every `*.form.ts` in `forms/` at build time and exports `forms` + `getForm()`.
**Do not add form definition files to this directory.**

If you need to understand the type system, see `src/lib/CLAUDE.md`.
