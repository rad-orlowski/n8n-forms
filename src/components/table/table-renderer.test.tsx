import { render, screen, fireEvent, within } from "@testing-library/react";
import { describe, it, expect, beforeAll } from "vitest";
import { TableRenderer } from "./TableRenderer";
import {
  registerCellRenderer,
  registerSectionRenderer,
  type Row,
} from "./registry";
import type { TableColumn, TableExpand } from "@/lib/schema";

// Register a generic (non-domain) renderer pair for the smoke test.
beforeAll(() => {
  registerCellRenderer("genericCell", (row: Row, col: TableColumn) => ({
    content: <span>{String(row[col.key])}</span>,
    sortValue: row[col.key] as string | number | null,
  }));
  registerSectionRenderer("genericSection", (row: Row) => (
    <div>detail:{String(row.name)}</div>
  ));
});

const columns: TableColumn[] = [
  { key: "name", label: "Name", sortable: true, kind: "genericCell" },
  { key: "score", label: "Score", sortable: true, align: "right", kind: "genericCell" },
];

const rows: Row[] = [
  { name: "Alpha", score: 3 },
  { name: "Bravo", score: 9 },
];

describe("TableRenderer (generic)", () => {
  it("defaults to the first sortable column, descending", () => {
    render(<TableRenderer rows={rows} columns={columns} expand={[]} />);
    const bodyRows = screen.getAllByRole("row").slice(1);
    // first sortable is "name", desc → Bravo before Alpha
    expect(within(bodyRows[0]).getByText("Bravo")).toBeTruthy();
  });

  it("clicking a header toggles sort direction", () => {
    render(<TableRenderer rows={rows} columns={columns} expand={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /Score/i }));
    const bodyRows = screen.getAllByRole("row").slice(1);
    // first click on Score → desc → Bravo (9) first
    expect(within(bodyRows[0]).getByText("Bravo")).toBeTruthy();
  });

  it("falls back to a stringified value when kind is unregistered", () => {
    const plain: TableColumn[] = [{ key: "name", label: "Name" }];
    render(<TableRenderer rows={rows} columns={plain} expand={[]} />);
    expect(screen.getByText("Alpha")).toBeInTheDocument();
  });

  it("expands a row via the registered section renderer", () => {
    const expand: TableExpand[] = [{ key: "d", kind: "genericSection" }];
    render(<TableRenderer rows={rows} columns={columns} expand={expand} />);
    fireEvent.click(screen.getByText("Bravo"));
    expect(screen.getByText("detail:Bravo")).toBeInTheDocument();
  });

  it("renders one filter select per filter config with humanized labels", () => {
    render(
      <TableRenderer
        rows={[{ name: "A", group: "fullTime" }, { name: "B", group: "partTime" }]}
        columns={columns}
        expand={[]}
        filters={[{ key: "group", label: "Group" }]}
      />,
    );
    expect(screen.getByText("Group")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Full time" })).toBeTruthy();
  });

  it("uses a neutral row count label", () => {
    render(<TableRenderer rows={rows} columns={columns} expand={[]} />);
    expect(screen.getByText("2 rows")).toBeInTheDocument();
  });
});
