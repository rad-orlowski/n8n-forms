import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import ky, { HTTPError, TimeoutError } from "ky";
import { DEFAULT_TIMEOUT_MS } from "./schema";
import { openEventStream, startForm, stepForm } from "./submit";

vi.mock("ky", async (importActual) => {
  const actual = await importActual<typeof import("ky")>();
  return { ...actual, default: { post: vi.fn() } };
});

// Re-point ky.post at a brand-new mock before each test rather than resetting
// the shared one. `mockReset()` on a reused mock corrupts vitest's settled-
// result tracking, surfacing a later mocked rejection as an uncaught error and
// failing the test even though startForm/stepForm catch it. A fresh fn each
// test sidesteps that; submit.ts reads `ky.post` live so the swap takes effect.
let post: Mock;
beforeEach(() => {
  post = vi.fn();
  (ky as unknown as { post: Mock }).post = post;
});

/** Build an HTTPError whose response yields the given body + status. */
function httpError(
  status: number,
  body: string,
  contentType = "application/json",
) {
  const res = new Response(body, {
    status,
    headers: { "content-type": contentType },
  });
  return new HTTPError(res, new Request("http://bff/x"), {} as never);
}

function jsonResponse(body: unknown) {
  return { json: async () => body } as unknown as Response;
}

describe("startForm", () => {
  it("returns a sync result with done coerced to boolean", async () => {
    post.mockResolvedValue(jsonResponse({ sessionId: "s1", data: { a: 1 } }));
    const res = await startForm("contact", { name: "x" });
    expect(res).toEqual({
      sessionId: "s1",
      pending: false,
      data: { a: 1 },
      done: false,
    });
  });

  it("returns a pending result when the BFF replies pending", async () => {
    post.mockResolvedValue(jsonResponse({ sessionId: "s2", pending: true }));
    expect(await startForm("contact", {})).toEqual({
      sessionId: "s2",
      pending: true,
    });
  });

  it("forwards answers and omits optional body keys when unset", async () => {
    post.mockResolvedValue(jsonResponse({ sessionId: "s", done: true }));
    await startForm("contact", { name: "x" });
    expect(post).toHaveBeenCalledWith("/api/forms/contact/start", {
      json: { answers: { name: "x" } },
      timeout: DEFAULT_TIMEOUT_MS,
    });
  });

  it("includes resumeUrlPath, method and timeoutMs when provided", async () => {
    post.mockResolvedValue(jsonResponse({ sessionId: "s", done: true }));
    await startForm("contact", {}, "data.resumeUrl", "GET", 1234);
    expect(post).toHaveBeenCalledWith("/api/forms/contact/start", {
      json: {
        answers: {},
        resumeUrlPath: "data.resumeUrl",
        method: "GET",
        timeoutMs: 1234,
      },
      timeout: 1234,
    });
  });

  it("maps the indefinite timeout to ky timeout:false", async () => {
    post.mockResolvedValue(jsonResponse({ sessionId: "s", done: true }));
    await startForm("contact", {}, undefined, undefined, "indefinite");
    expect(post.mock.calls[0][1]).toMatchObject({ timeout: false });
  });
});

describe("stepForm", () => {
  it("returns a sync step result", async () => {
    post.mockResolvedValue(jsonResponse({ data: { next: true }, done: true }));
    expect(await stepForm("s1", { a: 1 })).toEqual({
      pending: false,
      data: { next: true },
      done: true,
    });
  });

  it("returns pending when the BFF replies pending", async () => {
    post.mockResolvedValue(jsonResponse({ pending: true }));
    expect(await stepForm("s1", {})).toEqual({ pending: true });
  });

  it("targets the session step endpoint", async () => {
    post.mockResolvedValue(jsonResponse({ done: true }));
    await stepForm("sess-9", { a: 1 });
    expect(post).toHaveBeenCalledWith(
      "/api/sessions/sess-9/step",
      expect.anything(),
    );
  });
});

describe("error handling", () => {
  it("extracts the BFF error message from a JSON HTTPError body", async () => {
    post.mockRejectedValue(
      httpError(422, JSON.stringify({ error: "workflow failed" })),
    );
    expect(await startForm("contact", {})).toEqual({
      ok: false,
      status: 422,
      message: "workflow failed",
    });
  });

  it("falls back to the status line for a non-JSON error body", async () => {
    post.mockRejectedValue(httpError(500, "<html>oops</html>", "text/html"));
    expect(await stepForm("s1", {})).toEqual({
      ok: false,
      status: 500,
      message: "HTTP 500",
    });
  });

  it("maps a TimeoutError to status 0", async () => {
    const err = new TimeoutError(new Request("http://bff/x"));
    post.mockRejectedValue(err);
    expect(await startForm("contact", {})).toEqual({
      ok: false,
      status: 0,
      message: err.message,
    });
  });

  it("uses the message of a generic Error", async () => {
    post.mockRejectedValue(new Error("network down"));
    expect(await startForm("contact", {})).toEqual({
      ok: false,
      status: 0,
      message: "network down",
    });
  });

  it("uses a default message for a non-Error throw", async () => {
    post.mockRejectedValue("boom");
    const res = await startForm("contact", {});
    expect(res).toMatchObject({ ok: false, status: 0 });
    expect((res as { message: string }).message).toMatch(/could not reach BFF/);
  });
});

describe("openEventStream", () => {
  it("constructs an EventSource against the session events endpoint", () => {
    const ctor = vi.fn();
    vi.stubGlobal("EventSource", ctor);
    openEventStream("abc");
    expect(ctor).toHaveBeenCalledWith("/api/sessions/abc/events");
    vi.unstubAllGlobals();
  });
});
