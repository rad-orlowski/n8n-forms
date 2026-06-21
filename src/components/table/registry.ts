import type { ReactNode } from "react";
import type { TableColumn, TableExpand } from "@/lib/schema";

/**
 * Generic table renderer registry.
 *
 * The framework table engine (`TableRenderer.tsx`) is domain-agnostic: it knows
 * how to lay out rows, sort, filter and expand, but it does NOT know how any
 * particular cell or expand panel should look. A form supplies that knowledge by
 * registering a renderer under a string name, exactly like `icon` strings
 * resolve through `src/lib/icons.ts`. A column/expand entry then names its
 * renderer via `kind: "<name>"`.
 *
 * Registration is a side effect performed by a form's own (gitignored) renderer
 * module; the framework only ever resolves names through `getCellRenderer` /
 * `getSectionRenderer`. When no renderer is registered for a `kind`, the engine
 * falls back to a plain stringified value, so an unconfigured table still works.
 */

/** An opaque table row — shape is owned by the form, not the framework. */
export type Row = Record<string, unknown>;

/** A comparable value used by the engine to order rows. */
export type SortValue = string | number | null;

/** What a cell renderer returns: the rendered content plus an optional sort key. */
export interface CellResult {
  content: ReactNode;
  /** Value the engine sorts/compares on; falls back to `get(row, col.key)`. */
  sortValue?: SortValue;
}

/** Renders a single cell for `col` from `row`. */
export type CellRenderer = (row: Row, col: TableColumn) => CellResult;

/** Renders an expanded section for `expand` from `row` (full-width). */
export type SectionRenderer = (row: Row, expand: TableExpand) => ReactNode;

const cellRenderers = new Map<string, CellRenderer>();
const sectionRenderers = new Map<string, SectionRenderer>();

/** Register a cell renderer under `name` (the `kind` a column references). */
export function registerCellRenderer(name: string, renderer: CellRenderer): void {
  cellRenderers.set(name, renderer);
}

/** Register a section renderer under `name` (the `kind` an expand references). */
export function registerSectionRenderer(
  name: string,
  renderer: SectionRenderer,
): void {
  sectionRenderers.set(name, renderer);
}

/** Resolve a cell renderer by name, or `undefined` when none is registered. */
export function getCellRenderer(name: string | undefined): CellRenderer | undefined {
  return name ? cellRenderers.get(name) : undefined;
}

/** Resolve a section renderer by name, or `undefined` when none is registered. */
export function getSectionRenderer(
  name: string | undefined,
): SectionRenderer | undefined {
  return name ? sectionRenderers.get(name) : undefined;
}
