import { describe, it, expect } from "vitest";
import { isSpuriousEmptyChange } from "./select-field.helpers";
import type { FieldOption } from "@/lib/schema";

const OPTS: FieldOption[] = [
  { label: "Job One", value: "o1" },
  { label: "Job Two", value: "o2" },
];

describe("isSpuriousEmptyChange", () => {
  it("is true when an empty change arrives but the current value is still a valid option", () => {
    // Radix's mount-time reconciliation noise — clobbering a prefilled value.
    expect(isSpuriousEmptyChange("", "o1", OPTS)).toBe(true);
  });

  it("is false when the current value is no longer among the options (a real clear)", () => {
    // The selected option vanished from a refreshed list — the clear is legitimate.
    expect(
      isSpuriousEmptyChange("", "o1", [{ label: "Job Two", value: "o2" }]),
    ).toBe(false);
  });

  it("is false when the field is already empty (nothing to protect)", () => {
    expect(isSpuriousEmptyChange("", "", OPTS)).toBe(false);
  });

  it("is false for a real, non-empty selection", () => {
    expect(isSpuriousEmptyChange("o2", "o1", OPTS)).toBe(false);
  });

  it("is false when there are no options to confirm validity against", () => {
    expect(isSpuriousEmptyChange("", "o1", [])).toBe(false);
  });
});
