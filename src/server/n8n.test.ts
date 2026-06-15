import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HTTPError } from "ky";

// The module builds its ky instance once at import via `ky.create(...)`.
// Hoist a shared fake instance so tests can drive `.get` / `.post`.
const { instance } = vi.hoisted(() => ({
  instance: { get: vi.fn(), post: vi.fn() },
}));

vi.mock("ky", async (importActual) => {
  const actual = await importActual<typeof import("ky")>();
  return { ...actual, default: { create: () => instance } };
});

import {
  N8nCallError,
  N8nNetworkError,
  parseTimeout,
  postToN8n,
  type N8nPayload,
} from "./n8n";

const payload: N8nPayload = {
  answers: { a: 1 },
  sessionId: "s1",
  callbackUrl: "http://bff/cb",
};

function res(body: unknown, status = 200) {
  return new Response(body === null ? null : JSON.stringify(body), { status });
}

function httpError(status: number) {
  return new HTTPError(
    new Response(null, { status }),
    new Request("http://n8n/x"),
    {} as never,
  );
}

beforeEach(() => {
  instance.get.mockReset();
  instance.post.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("parseTimeout", () => {
  it("maps 'indefinite' to false", () => {
    expect(parseTimeout("indefinite")).toBe(false);
  });
  it("passes through a positive finite number", () => {
    expect(parseTimeout(2500)).toBe(2500);
  });
  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    "5000",
    null,
    undefined,
    {},
  ])("returns undefined for %j", (v) => {
    expect(parseTimeout(v)).toBeUndefined();
  });
});

describe("postToN8n", () => {
  it("returns pending on a 202", async () => {
    instance.post.mockResolvedValue(res(null, 202));
    expect(await postToN8n("http://n8n/hook", payload)).toEqual({
      pending: true,
    });
  });

  it("uses an explicit data key and resolves the top-level resumeUrl", async () => {
    instance.post.mockResolvedValue(
      res({ data: { x: 1 }, resumeUrl: "http://n8n/resume", done: false }),
    );
    expect(await postToN8n("http://n8n/hook", payload)).toEqual({
      pending: false,
      data: { x: 1 },
      resumeUrl: "http://n8n/resume",
      done: false,
    });
  });

  it("exposes the rest of the payload as data when no data key is present", async () => {
    instance.post.mockResolvedValue(
      res({ ticket: "T-1", status: "open", resumeUrl: "u", done: true }),
    );
    const result = await postToN8n("http://n8n/hook", payload);
    expect(result).toEqual({
      pending: false,
      data: { ticket: "T-1", status: "open" },
      resumeUrl: "u",
      done: true,
    });
  });

  it("returns null data when the body has only internal keys", async () => {
    instance.post.mockResolvedValue(res({ resumeUrl: null, done: false }));
    const result = await postToN8n("http://n8n/hook", payload);
    expect(result).toMatchObject({
      pending: false,
      data: null,
      resumeUrl: null,
    });
  });

  it("infers done from the absence of a resumeUrl", async () => {
    instance.post.mockResolvedValue(res({ data: "x" }));
    expect(await postToN8n("http://n8n/hook", payload)).toMatchObject({
      done: true,
      resumeUrl: null,
    });
  });

  it("treats a 2xx with a non-JSON body as done with no data", async () => {
    instance.post.mockResolvedValue(new Response("not json", { status: 200 }));
    expect(await postToN8n("http://n8n/hook", payload)).toEqual({
      pending: false,
      data: null,
      resumeUrl: null,
      done: true,
    });
  });

  it("unwraps an array-wrapped payload", async () => {
    instance.post.mockResolvedValue(res([{ data: { ok: 1 }, resumeUrl: "r" }]));
    expect(await postToN8n("http://n8n/hook", payload)).toMatchObject({
      data: { ok: 1 },
      resumeUrl: "r",
    });
  });

  it("resolves resumeUrl via a dot-path when resumeUrlPath is given", async () => {
    instance.post.mockResolvedValue(
      res({ data: 1, meta: { next: "http://n8n/deep" } }),
    );
    const result = await postToN8n("http://n8n/hook", payload, {
      resumeUrlPath: "meta.next",
    });
    expect(result).toMatchObject({ resumeUrl: "http://n8n/deep" });
  });

  describe("workflow business error (__error: true)", () => {
    it("surfaces the workflow message", async () => {
      instance.post.mockResolvedValue(
        res({ __error: true, message: "  bad input  " }),
      );
      expect(await postToN8n("http://n8n/hook", payload)).toEqual({
        pending: false,
        workflowError: true,
        message: "bad input",
      });
    });

    it("uses a default message when none is supplied", async () => {
      instance.post.mockResolvedValue(res({ __error: true }));
      expect(await postToN8n("http://n8n/hook", payload)).toMatchObject({
        workflowError: true,
        message: "The workflow reported an error.",
      });
    });
  });

  describe("method handling", () => {
    it("issues a GET without a body when method is GET", async () => {
      instance.get.mockResolvedValue(res({ data: 1 }));
      await postToN8n("http://n8n/hook", payload, { method: "GET" });
      expect(instance.get).toHaveBeenCalledWith("http://n8n/hook", {});
      expect(instance.post).not.toHaveBeenCalled();
    });

    it("spreads an explicit timeout into the POST options", async () => {
      instance.post.mockResolvedValue(res({ data: 1 }));
      await postToN8n("http://n8n/hook", payload, { timeout: 1500 });
      expect(instance.post).toHaveBeenCalledWith("http://n8n/hook", {
        json: payload,
        timeout: 1500,
      });
    });

    it("omits the timeout option when unset", async () => {
      instance.post.mockResolvedValue(res({ data: 1 }));
      await postToN8n("http://n8n/hook", payload);
      expect(instance.post).toHaveBeenCalledWith("http://n8n/hook", {
        json: payload,
      });
    });
  });

  describe("failures", () => {
    it("throws N8nCallError carrying the HTTP status", async () => {
      instance.post.mockRejectedValue(httpError(503));
      await expect(postToN8n("http://n8n/hook", payload)).rejects.toMatchObject(
        {
          name: "N8nCallError",
          status: 503,
        },
      );
      await expect(
        postToN8n("http://n8n/hook", payload),
      ).rejects.toBeInstanceOf(N8nCallError);
    });

    it("wraps a non-HTTP failure in N8nNetworkError", async () => {
      const cause = new Error("ECONNREFUSED");
      instance.post.mockRejectedValue(cause);
      const err = await postToN8n("http://n8n/hook", payload).catch((e) => e);
      expect(err).toBeInstanceOf(N8nNetworkError);
      expect((err as N8nNetworkError).cause).toBe(cause);
    });
  });
});
