import { describe, it, expect } from "vitest";
import { evaluateCondition, validateExpressionSyntax } from "./expr";

describe("evaluateCondition", () => {
  it("evaluates equality against scope (single-quoted string)", () => {
    expect(evaluateCondition("country == 'US'", { country: "US" })).toBe(true);
    expect(evaluateCondition("country == 'US'", { country: "DE" })).toBe(false);
  });
  it("supports and / or / comparison", () => {
    expect(
      evaluateCondition("age >= 18 and country == 'US'", {
        age: 20,
        country: "US",
      }),
    ).toBe(true);
    expect(evaluateCondition("age >= 18 or vip", { age: 5, vip: true })).toBe(
      true,
    );
  });
  it("returns false on unknown variables instead of throwing", () => {
    expect(evaluateCondition("missing == 'x'", {})).toBe(false);
  });
  it("coerces truthy/falsy results to boolean", () => {
    expect(evaluateCondition("flag", { flag: true })).toBe(true);
    expect(evaluateCondition("flag", { flag: false })).toBe(false);
  });
});

describe("validateExpressionSyntax", () => {
  it("accepts a well-formed expression", () => {
    expect(validateExpressionSyntax("a == 'b'")).toEqual({ ok: true });
  });
  it("rejects a broken expression with a message", () => {
    const r = validateExpressionSyntax("a == ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
  });
  it("rejects random() — built-in functions are disabled", () => {
    // Built-in functions are intentionally disabled to prevent non-deterministic
    // or side-effectful visibility conditions in form definitions.
    const r = validateExpressionSyntax("random() > 0.5");
    expect(r.ok).toBe(false);
  });
  it("returns false for random() in evaluateCondition — safe default", () => {
    // Whether it fails at parse or evaluate time, evaluateCondition must return false.
    expect(evaluateCondition("random() > 0.5", {})).toBe(false);
  });
});
