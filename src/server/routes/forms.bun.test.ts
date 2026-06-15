import { beforeEach, describe, expect, it, mock } from "bun:test";
import { getSession } from "../db.ts";

// Mock the n8n proxy so no real network call is made. parseTimeout keeps its
// real-ish behaviour (the route only forwards its result).
const postToN8n = mock();
mock.module("../n8n.ts", () => ({
  postToN8n,
  parseTimeout: (raw: unknown) =>
    raw === "indefinite"
      ? false
      : typeof raw === "number" && raw > 0
        ? raw
        : undefined,
}));

process.env.WEBHOOK_CONTACT = "http://n8n/webhook/contact";

// Import after the mock is registered so forms.ts binds to the mocked n8n.
const { default: forms } = await import("./forms.ts");

function start(slug: string, body: unknown) {
  return forms.request(`/${slug}/start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => postToN8n.mockReset());

describe("POST /:slug/start", () => {
  it("404s when the form has no configured webhook", async () => {
    const res = await start("unconfigured", { answers: {} });
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Form not configured" });
    expect(postToN8n).not.toHaveBeenCalled();
  });

  it("returns sync data and persists resumeUrl + done", async () => {
    postToN8n.mockResolvedValue({
      pending: false,
      workflowError: false,
      data: { greeting: "hi" },
      resumeUrl: "http://n8n/resume",
      done: false,
    });
    const res = await start("contact", { answers: { name: "x" } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      sessionId: string;
      data: unknown;
      done: boolean;
    };
    expect(body).toMatchObject({ data: { greeting: "hi" }, done: false });

    const stored = getSession(body.sessionId);
    expect(stored).toMatchObject({
      resumeUrl: "http://n8n/resume",
      done: false,
    });
  });

  it("returns a pending indicator on a 202 (async) result", async () => {
    postToN8n.mockResolvedValue({ pending: true });
    const res = await start("contact", { answers: {} });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ pending: true });
  });

  it("maps a workflow business error to 422", async () => {
    postToN8n.mockResolvedValue({
      pending: false,
      workflowError: true,
      message: "bad input",
    });
    const res = await start("contact", { answers: {} });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "bad input" });
  });

  it("400s on an invalid JSON body", async () => {
    const res = await start("contact", "not json");
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON body" });
  });

  it("502s when the n8n call throws", async () => {
    postToN8n.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await start("contact", { answers: {} });
    expect(res.status).toBe(502);
    expect((await res.json()) as { error: string }).toMatchObject({
      error: expect.stringContaining("Failed to reach n8n"),
    });
  });

  it("forwards resumeUrlPath and method through to postToN8n", async () => {
    postToN8n.mockResolvedValue({
      pending: false,
      data: null,
      resumeUrl: null,
      done: true,
    });
    await start("contact", {
      answers: { a: 1 },
      resumeUrlPath: "meta.next",
      method: "GET",
    });
    expect(postToN8n).toHaveBeenCalledWith(
      "http://n8n/webhook/contact",
      expect.objectContaining({ answers: { a: 1 } }),
      expect.objectContaining({ resumeUrlPath: "meta.next", method: "GET" }),
    );
  });
});
