import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { get } from "es-toolkit/compat";
import type { TableColumn, TableExpand } from "@/lib/schema";
import type { Row } from "./registry";
import { getCellRenderer, getSectionRenderer } from "./registry";
import { sortRows, filterRows, uniqueValues, humanize } from "./table-utils";

export interface TableFilter {
  key: string;
  label: string;
}

/**
 * Generic, domain-agnostic table engine.
 *
 * Layout, sorting, filtering and expand/collapse live here. How a cell or an
 * expanded panel actually looks is delegated to renderers a form registers by
 * name (see `registry.ts`); `col.kind` / `expand.kind` select the renderer. When
 * no renderer is registered for a kind, a cell falls back to the stringified
 * value at `col.key` and an expand entry renders nothing.
 */
export function TableRenderer({
  rows,
  columns,
  expand,
  filters = [],
}: {
  rows: Row[];
  columns: TableColumn[];
  expand: TableExpand[];
  filters?: TableFilter[];
}) {
  // Default sort: first sortable column, descending. No domain-specific default.
  const firstSortable = columns.find((c) => c.sortable)?.key ?? columns[0]?.key ?? "";
  const [sortKey, setSortKey] = useState(firstSortable);
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [active, setActive] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<number | null>(null);

  const getSortValue = (row: Row) => {
    const col = columns.find((c) => c.key === sortKey);
    if (col) {
      const r = getCellRenderer(col.kind);
      if (r) {
        const sv = r(row, col).sortValue;
        if (sv !== undefined) return sv;
      }
    }
    const raw = get(row, sortKey);
    return (raw == null ? null : (raw as string | number));
  };

  const view = useMemo(
    () => sortRows(filterRows(rows, active), getSortValue, dir),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, active, sortKey, dir],
  );

  function clickHeader(col: TableColumn) {
    if (!col.sortable) return;
    if (sortKey === col.key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(col.key);
      setDir("desc");
    }
  }

  return (
    <div className="data-table">
      <div className="flex flex-wrap items-center gap-3 mb-3 text-sm">
        {filters.map((f) => (
          <FilterSelect
            key={f.key}
            filter={f}
            rows={rows}
            value={active[f.key] ?? ""}
            onChange={(v) => setActive((a) => ({ ...a, [f.key]: v }))}
          />
        ))}
        <span className="ml-auto text-muted-foreground text-xs">
          {view.length} {view.length === 1 ? "row" : "rows"}
        </span>
      </div>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`label-tech text-left p-2 border-b border-border ${col.align === "right" ? "text-right" : ""}`}
              >
                {col.sortable ? (
                  <button
                    className="inline-flex items-center gap-1"
                    onClick={() => clickHeader(col)}
                  >
                    {col.label ?? col.key}
                    {sortKey === col.key && (
                      <span className="text-amber-400">
                        {dir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </button>
                ) : (
                  (col.label ?? col.key)
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {view.map((row, i) => (
            <FragmentRow
              key={i}
              row={row}
              columns={columns}
              expand={expand}
              isOpen={open === i}
              onToggle={() => setOpen(open === i ? null : i)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterSelect({
  filter,
  rows,
  value,
  onChange,
}: {
  filter: TableFilter;
  rows: Row[];
  value: string;
  onChange: (v: string) => void;
}) {
  const options = useMemo(() => uniqueValues(rows, filter.key), [rows, filter.key]);
  const id = `filter-${filter.key}`;
  return (
    <>
      <label htmlFor={id} className="label-tech text-muted-foreground">
        {filter.label}
      </label>
      <select
        id={id}
        className="bg-card border border-border rounded px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {humanize(o)}
          </option>
        ))}
      </select>
    </>
  );
}

function FragmentRow({
  row,
  columns,
  expand,
  isOpen,
  onToggle,
}: {
  row: Row;
  columns: TableColumn[];
  expand: TableExpand[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="cursor-pointer hover:bg-muted/30" onClick={onToggle}>
        {columns.map((col, i) => {
          const r = getCellRenderer(col.kind);
          const cell = r
            ? r(row, col)
            : { content: String(get(row, col.key) ?? "—") };
          return (
            <td
              key={col.key}
              className={`p-2 border-b border-border whitespace-nowrap ${col.align === "right" ? "text-right tabular-nums" : ""}`}
            >
              {i === 0 && (
                <ChevronDown
                  className={`inline size-3 mr-1 transition-transform ${isOpen ? "" : "-rotate-90"}`}
                  aria-hidden
                />
              )}
              {cell.content}
            </td>
          );
        })}
      </tr>
      {isOpen && expand.length > 0 && (
        <tr>
          <td colSpan={columns.length} className="p-0 bg-background/60">
            <div className="space-y-5 p-4 animate-field-in">
              {expand.map((e) => {
                const render = getSectionRenderer(e.kind);
                return render ? (
                  <div key={e.key}>{render(row, e)}</div>
                ) : null;
              })}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
