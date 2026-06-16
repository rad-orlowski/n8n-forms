import { describe, it, expect, vi, afterEach } from "vitest";
import { Mail } from "lucide-react";
import { resolveIcon } from "./icons";

afterEach(() => vi.restoreAllMocks());

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
  it("warns once for an unknown non-empty name", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // Unique name so the module-level dedup Set hasn't seen it in this run.
    resolveIcon("DefinitelyNotARealIconXYZ");
    resolveIcon("DefinitelyNotARealIconXYZ");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toMatch(/unknown icon/i);
  });
  it("does not warn for undefined input", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    resolveIcon(undefined);
    expect(warn).not.toHaveBeenCalled();
  });
});
