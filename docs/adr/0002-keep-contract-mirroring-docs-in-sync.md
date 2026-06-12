---
id: "0002"
title: "Update contract-mirroring docs in the same change that alters the contract"
status: accepted
date: "2026-06-12"
applies-to:
  - "src/lib/schema.ts"
  - "forms/**"
  - "src/components/fields/**"
  - "src/server/**"
global: false
tags:
  - docs
  - process
  - contract
supersedes: null
superseded-by: null
---

## Context

Several docs in this repo restate the form/response contract by example rather than
importing it — the form-authoring guides, the README, and the `create-n8n-form` skill
all contain hand-written `*.form.ts` snippets and field/response tables. Because nothing
ties those snippets to the real types, they rot silently when the contract changes:

- The **BFF / dynamic-forms rewrite** replaced client-side `webhook:` /
  `import.meta.env.VITE_WEBHOOK_*` / flat `fields:` / a `file://` single-file artifact
  with server-side `WEBHOOK_<SLUG>`, `pages: [{ fields }]`, auto-discovery, and a
  BFF-served SPA — but the `create-n8n-form` skill kept teaching the old model for an
  entire release, so it would have scaffolded broken forms.
- The **response-panel restyle** removed top-level `successMessage` and `response.title`
  (folding them into `response.header`) and added `format: "list"` + `prose`, but left
  stale `successMessage` / `response.title` references scattered across the docs.

The failure mode is always the same: a contract file changes, the mirroring docs don't,
and the drift is invisible until someone follows a stale doc. "Remember to update the
docs" is not a control — it already failed twice.

## Decision

A change that alters the form/response contract (the files in `applies-to`) **must**
update the docs that mirror it, in the **same** change. The mirror map:

| Contract source | Mirroring docs to keep in sync |
|---|---|
| `src/lib/schema.ts` (FieldDef, PageDef, FormSchema, ResponseConfig/Field/Header) | `README.md`, `forms/CLAUDE.md`, `src/lib/CLAUDE.md`, `.claude/skills/create-n8n-form/{SKILL,reference,examples}.md` |
| `forms/**` (authoring conventions, env-key naming, slug→`WEBHOOK_<SLUG>`) | `forms/CLAUDE.md`, `README.md`, `.claude/skills/create-n8n-form/*`, `.env.example` |
| `src/components/fields/**` (field registry, available `type`s) | `src/components/fields/CLAUDE.md`, `forms/CLAUDE.md` (field table), `.claude/skills/create-n8n-form/reference.md` |
| `src/server/**` (BFF routes, env loading, n8n envelope, CORS posture) | `README.md`, root `CLAUDE.md` (Architecture), `docs/n8n-contract.md`, `.claude/skills/create-n8n-form/reference.md` |

Rules:

- When you remove or rename a contract identifier (e.g. `successMessage`, `VITE_WEBHOOK`,
  `webhook:`), grep all docs for it and fix every reference — deletions are the most common
  rot source.
- Doc code-fence snippets must reflect the current shape (`pages:`, `response.header`,
  server-side env), not a superseded one.
- If a change is large enough to dispatch subagents, give one a doc-sync task covering the
  mirror map above.

## Consequences

- Docs and the `create-n8n-form` skill stay trustworthy; agents scaffolding new forms get
  the current model instead of a rotted one.
- The advisory `PreToolUse` ADR hook surfaces this rule whenever an agent edits a contract
  file, turning "remember to" into an in-session nudge.
- Small recurring cost: contract changes now carry a doc-update tax. This is intended — the
  alternative (silent drift) cost more.
- Stronger mechanical enforcement (a grep-guard test for removed identifiers, or
  typechecking extracted doc snippets against the real schema) is a possible follow-up but
  is deliberately out of scope here; this ADR establishes the obligation, not the CI gate.
