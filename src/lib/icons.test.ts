import { describe, it, expect } from "vitest";
import { Mail } from "lucide-react";
import { resolveIcon } from "./icons";

describe("resolveIcon", () => {
  it("resolves a known name to a component", () => {
    expect(resolveIcon("Mail")).toBe(Mail);
  });
  it("returns undefined for an unknown name", () => {
    expect(resolveIcon("NotAnIcon")).toBeUndefined();
  });
  it("returns undefined for undefined input", () => {
    expect(resolveIcon(undefined)).toBeUndefined();
  });
});
