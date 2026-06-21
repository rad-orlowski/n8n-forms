import { describe, it, expect } from "vitest";
import { humanize, sortRows, filterRows, uniqueValues } from "./table-utils";
import { get } from "es-toolkit/compat";
import type { Row } from "./registry";

describe("humanize", () => {
  it("camelCase → sentence case words", () => {
    expect(humanize("fullTime")).toBe("Full time");
    expect(humanize("remoteFirst")).toBe("Remote first");
    expect(humanize("scored")).toBe("Scored");
  });
});

describe("sortRows", () => {
  const rows: Row[] = [
    { id: "a", score: 5 },
    { id: "b", score: null },
    { id: "c", score: 3 },
  ];
  const byScore = (r: Row) => (r.score as number | null) ?? null;

  it("desc keeps nullish last", () => {
    expect(sortRows(rows, byScore, "desc").map((r) => r.id)).toEqual([
      "a",
      "c",
      "b",
    ]);
  });
  it("asc keeps nullish last", () => {
    expect(sortRows(rows, byScore, "asc").map((r) => r.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
  it("string values sort lexicographically", () => {
    const r: Row[] = [{ id: "x", n: "Beta" }, { id: "y", n: "Alpha" }];
    expect(
      sortRows(r, (row) => row.n as string, "asc").map((row) => row.id),
    ).toEqual(["y", "x"]);
  });
});

describe("filterRows", () => {
  const rows: Row[] = [
    { id: "a", stage: "scored", state: "converging" },
    { id: "b", stage: "screening", state: "complete" },
  ];
  it("filters by one key", () => {
    expect(filterRows(rows, { stage: "scored" }).map((r) => r.id)).toEqual(["a"]);
  });
  it("empty constraints return all", () => {
    expect(filterRows(rows, { stage: "" }).length).toBe(2);
  });
  it("supports dot-path keys", () => {
    const nested: Row[] = [
      { id: "a", meta: { kind: "x" } },
      { id: "b", meta: { kind: "y" } },
    ];
    expect(filterRows(nested, { "meta.kind": "y" }).map((r) => r.id)).toEqual([
      "b",
    ]);
  });
});

describe("uniqueValues", () => {
  const rows: Row[] = [
    { stage: "scored" },
    { stage: "screening" },
    { stage: "scored" },
    { stage: "" },
  ];
  it("dedupes, sorts, drops empties", () => {
    expect(uniqueValues(rows, "stage")).toEqual(["scored", "screening"]);
  });
  it("reads dot-paths via es-toolkit get", () => {
    const nested: Row[] = [{ m: { k: "b" } }, { m: { k: "a" } }];
    expect(uniqueValues(nested, "m.k")).toEqual(["a", "b"]);
    expect(get(nested[0], "m.k")).toBe("b");
  });
});
