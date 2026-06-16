import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveFormConfig, slugToEnvKey, FORMS_DIR } from "./config.ts";
import { isAbsolute } from "node:path";

/** Re-import config.ts with SHOW_EXAMPLE_FORMS set to `value` (or unset). */
async function loadFlag(value?: string): Promise<boolean> {
  vi.resetModules();
  vi.unstubAllEnvs();
  if (value !== undefined) vi.stubEnv("SHOW_EXAMPLE_FORMS", value);
  const mod = await import("./config.ts");
  return mod.SHOW_EXAMPLE_FORMS;
}

describe("slugToEnvKey", () => {
  it.each([
    ["contact", "CONTACT"],
    ["event-rsvp", "EVENT_RSVP"],
    ["wizard-demo", "WIZARD_DEMO"],
    ["add.job/info", "ADD_JOB_INFO"],
  ])("normalises %j to %j", (slug, key) => {
    expect(slugToEnvKey(slug)).toBe(key);
  });
});

describe("resolveFormConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns the webhook URL when WEBHOOK_<SLUG> is set", () => {
    vi.stubEnv("WEBHOOK_EVENT_RSVP", "https://n8n.example/webhook/rsvp");
    expect(resolveFormConfig("event-rsvp")).toEqual({
      webhookUrl: "https://n8n.example/webhook/rsvp",
    });
  });

  it("returns null when the env var is absent", () => {
    vi.stubEnv("WEBHOOK_UNCONFIGURED", "");
    expect(resolveFormConfig("unconfigured")).toBeNull();
  });
});

describe("PORT and PUBLIC_BASE_URL", () => {
  afterEach(() => vi.unstubAllEnvs());

  async function loadConfig(env: Record<string, string>) {
    vi.resetModules();
    vi.unstubAllEnvs();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return import("./config.ts");
  }

  it("defaults PORT to 3000 and derives PUBLIC_BASE_URL from it", async () => {
    const mod = await loadConfig({});
    expect(mod.PORT).toBe(3000);
    expect(mod.PUBLIC_BASE_URL).toBe("http://localhost:3000");
  });

  it("honours an explicit PORT", async () => {
    const mod = await loadConfig({ PORT: "8080" });
    expect(mod.PORT).toBe(8080);
    expect(mod.PUBLIC_BASE_URL).toBe("http://localhost:8080");
  });

  it("uses PUBLIC_BASE_URL when set and strips a trailing slash", async () => {
    const mod = await loadConfig({
      PUBLIC_BASE_URL: "https://forms.example.com/",
    });
    expect(mod.PUBLIC_BASE_URL).toBe("https://forms.example.com");
  });
});

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

describe("FORMS_DIR", () => {
  it("is an absolute path", () => {
    expect(isAbsolute(FORMS_DIR)).toBe(true);
  });
  it("defaults to a forms directory", () => {
    expect(FORMS_DIR.endsWith("forms")).toBe(true);
  });
});
