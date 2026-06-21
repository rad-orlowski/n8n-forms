import { describe, it, expect } from "vitest";
import { parseHashQuery } from "./hash";

describe("parseHashQuery", () => {
  it("returns an empty object when the hash has no query string", () => {
    window.location.hash = "#/act";
    expect(parseHashQuery()).toEqual({});
  });

  it("extracts query params from the hash", () => {
    window.location.hash = "#/act?opp=o1&foo=bar";
    expect(parseHashQuery()).toEqual({ opp: "o1", foo: "bar" });
  });

  it("decodes percent-encoded values", () => {
    window.location.hash = "#/act?opp=" + encodeURIComponent("123-a b");
    expect(parseHashQuery()).toEqual({ opp: "123-a b" });
  });

  it("returns an empty object when there is no hash at all", () => {
    window.location.hash = "";
    expect(parseHashQuery()).toEqual({});
  });
});
