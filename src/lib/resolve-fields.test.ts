import { describe, it, expect } from "vitest";
import { resolveVisibleFields } from "./resolve-fields";
import type { FieldDef } from "./schema";

const fields: FieldDef[] = [
  { type: "select", name: "country" },
  { type: "text", name: "state", visibleIf: "country == 'US'" },
  { type: "text", name: "vat", requiredIf: "country == 'DE'" },
];

describe("resolveVisibleFields", () => {
  it("hides a field whose visibleIf is false", () => {
    const out = resolveVisibleFields(fields, { country: "DE" });
    expect(out.map((f) => f.name)).toEqual(["country", "vat"]);
  });
  it("shows a field whose visibleIf is true", () => {
    const out = resolveVisibleFields(fields, { country: "US" });
    expect(out.map((f) => f.name)).toContain("state");
  });
  it("sets required from requiredIf", () => {
    const us = resolveVisibleFields(fields, { country: "US" });
    const de = resolveVisibleFields(fields, { country: "DE" });
    expect(us.find((f) => f.name === "vat")?.required).toBe(false);
    expect(de.find((f) => f.name === "vat")?.required).toBe(true);
  });
  it("passes fields without conditions through unchanged", () => {
    const out = resolveVisibleFields(
      [{ type: "text", name: "x", required: true }],
      {},
    );
    expect(out[0].required).toBe(true);
  });
});
