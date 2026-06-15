import { afterEach, describe, expect, it, vi } from "vitest";

/** Re-import config.ts with SHOW_EXAMPLE_FORMS set to `value` (or unset). */
async function loadFlag(value?: string): Promise<boolean> {
  vi.resetModules();
  vi.unstubAllEnvs();
  if (value !== undefined) vi.stubEnv("SHOW_EXAMPLE_FORMS", value);
  const mod = await import("./config.ts");
  return mod.SHOW_EXAMPLE_FORMS;
}

describe("SHOW_EXAMPLE_FORMS", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to true when unset", async () => {
    expect(await loadFlag(undefined)).toBe(true);
  });

  it.each([
    "false",
    "0",
    "no",
    "off",
    "",
    "FALSE",
    " Off ",
  ])("is false for falsy value %j", async (v) => {
    expect(await loadFlag(v)).toBe(false);
  });

  it.each([
    "true",
    "1",
    "yes",
    "anything",
  ])("is true for non-falsy value %j", async (v) => {
    expect(await loadFlag(v)).toBe(true);
  });
});
