---
id: "0001"
title: "Record architectural decisions as ADRs in docs/adr"
status: accepted
date: "2026-06-12"
global: true
tags:
  - meta
  - process
supersedes: null
superseded-by: null
---

## Context

Coding agents (and humans) repeatedly re-litigate or unknowingly override
architectural decisions because the rationale lives only in chat history or a
single person's head. The project needs a durable, in-repo, agent-readable record
of binding decisions — one that scales to hundreds of entries without forcing every
agent to load them all.

## Decision

Record significant architectural and process decisions as ADRs under `docs/adr/`:

- Each ADR is a Markdown file `NNNN-kebab-title.md` with YAML frontmatter (the
  source of truth) and Context / Decision / Consequences sections.
- A generated `README.md` (tiered index) and `.adr-index.json` (hook manifest) are
  produced from frontmatter by `generate.py` — never hand-edited.
- Scope is expressed via `applies-to` globs, `tags`, or `global: true`.
- A non-blocking `PreToolUse` hook surfaces the relevant ADR when an agent edits a
  file matching an accepted ADR's globs.
- Statuses: `proposed → accepted → (superseded | deprecated)`, plus `rejected`.
  Retired ADRs stay on disk but leave the active index/manifest.

## Consequences

- Agents can be pointed at `docs/adr/README.md` and the per-file hook to stay within
  established decisions, reducing drift.
- A small authoring discipline is required: capture decisions as ADRs and regenerate
  the index (the skill and a pre-commit hook automate this).
- History is preserved via supersession rather than deletion.
