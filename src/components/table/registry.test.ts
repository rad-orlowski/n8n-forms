import { describe, it, expect } from "vitest";
import {
  registerCellRenderer,
  registerSectionRenderer,
  getCellRenderer,
  getSectionRenderer,
  type Row,
} from "./registry";

describe("table renderer registry", () => {
  it("registers and resolves a cell renderer by name", () => {
    const r = (row: Row) => ({ content: String(row.x) });
    registerCellRenderer("testCell", r);
    expect(getCellRenderer("testCell")).toBe(r);
  });

  it("registers and resolves a section renderer by name", () => {
    const r = () => null;
    registerSectionRenderer("testSection", r);
    expect(getSectionRenderer("testSection")).toBe(r);
  });

  it("returns undefined for an unregistered or absent name", () => {
    expect(getCellRenderer("nope")).toBeUndefined();
    expect(getCellRenderer(undefined)).toBeUndefined();
    expect(getSectionRenderer("nope")).toBeUndefined();
    expect(getSectionRenderer(undefined)).toBeUndefined();
  });
});
