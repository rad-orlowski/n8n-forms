/**
 * Loads form-supplied renderer extensions into the table registry.
 *
 * Forms register their own cell/section renderers (see `registry.ts`) from a
 * module named `*.renderers.{ts,tsx}` placed anywhere under the top-level
 * `forms/` tree. Importing such a module runs its `registerCellRenderer` /
 * `registerSectionRenderer` side effects.
 *
 * This loader is intentionally generic: it knows nothing about any specific
 * form or domain — it just eagerly imports every matching module so that, by
 * the time the table engine resolves a `kind` string, the corresponding
 * renderer has been registered. Forms with no custom rendering simply contribute
 * no module here and the engine falls back to plain values.
 *
 * `forms/` is gitignored, so this glob may match nothing in a clean checkout —
 * that is fine and expected.
 */

// eager: registration must happen before any table renders.
import.meta.glob("/forms/**/*.renderers.{ts,tsx}", { eager: true });
