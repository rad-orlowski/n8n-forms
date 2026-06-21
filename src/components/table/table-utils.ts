import { get } from "es-toolkit/compat";
import type { Row, SortValue } from "./registry";

/**
 * Humanise an enum-ish value: camelCase → words, sentence case.
 * "fullTime" → "Full time", "scored" → "Scored", "remoteFirst" → "Remote first".
 */
export function humanize(v: string): string {
  const lower = v.replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

/** True for values that should sort last regardless of direction. */
function isNullish(v: SortValue): boolean {
  return v === null || v === undefined || v === "";
}

/**
 * Sort `rows` by a per-row sort value, keeping nullish values last in both
 * directions. `getSortValue` lets the caller supply a renderer-derived key;
 * the default reads `get(row, key)`.
 */
export function sortRows(
  rows: Row[],
  getSortValue: (row: Row) => SortValue,
  dir: "asc" | "desc",
): Row[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((ra, rb) => {
    const a = getSortValue(ra);
    const b = getSortValue(rb);
    const aNull = isNullish(a);
    const bNull = isNullish(b);
    if (aNull && bNull) return 0;
    if (aNull) return 1; // nullish always last, regardless of dir
    if (bNull) return -1;
    if (typeof a === "number" && typeof b === "number") return (a - b) * sign;
    return String(a).localeCompare(String(b)) * sign;
  });
}

/**
 * Keep only rows matching every active filter. `activeFilters` maps a row
 * dot-path → required raw value; an empty/missing value means "no constraint".
 */
export function filterRows(
  rows: Row[],
  activeFilters: Record<string, string>,
): Row[] {
  const constraints = Object.entries(activeFilters).filter(([, v]) => v !== "");
  if (constraints.length === 0) return rows;
  return rows.filter((row) =>
    constraints.every(([key, want]) => String(get(row, key) ?? "") === want),
  );
}

/** Distinct, sorted, non-empty raw values at `key` across `rows`. */
export function uniqueValues(rows: Row[], key: string): string[] {
  const values = rows
    .map((r) => get(r, key))
    .filter((v): v is string | number => v != null && v !== "")
    .map(String);
  return [...new Set(values)].sort();
}
