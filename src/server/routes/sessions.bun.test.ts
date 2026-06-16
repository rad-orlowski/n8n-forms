import { beforeEach, describe, expect, it, mock } from "bun:test";
import { createSession, getSession, updateSession } from "../db.ts";
import { publish, hasSubscriber } from "../events.ts";

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

const { default: sessions } = await import("./sessions.ts");

let counter = 0;
const newId = () => `step-session-${++counter}`;

/** Create a session that is mid-flow (has a resumeUrl, not done). */
function liveSession(): string {
  const id = newId();
  createSession({ sessionId: id, formSlug: "wizard" });
  updateSession(id, { resumeUrl: "http://n8n/resume" });
  return id;
}

function step(id: string, body: unknown) {
  return sessions.request(`/${id}/step`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => postToN8n.mockReset());

describe("POST /:id/step", () => {
  it("404s for an unknown session", async () => {
    const res = await step("nope", { answers: {} });
    expect(res.status).toBe(404);
  });

  it("409s when the session is already done", async () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });
    updateSession(id, { resumeUrl: "http://n8n/resume", done: true });
    const res = await step(id, { answers: {} });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "Session is already complete" });
  });

  it("409s when there is no resumeUrl", async () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });
    const res = await step(id, { answers: {} });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "No resume URL available for this session",
    });
  });

  it("400s on an invalid JSON body", async () => {
    const res = await step(liveSession(), "not json");
    expect(res.status).toBe(400);
  });

  it("returns sync data and persists the next resumeUrl", async () => {
    const id = liveSession();
    postToN8n.mockResolvedValue({
      pending: false,
      data: { step: 2 },
      resumeUrl: "http://n8n/resume2",
      done: false,
    });
    const res = await step(id, { answers: { a: 1 } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { step: 2 }, done: false });
    expect(getSession(id)).toMatchObject({
      resumeUrl: "http://n8n/resume2",
      lastPayload: { step: 2 },
    });
  });

  it("clears resumeUrl and buffered payload on a pending result", async () => {
    const id = liveSession();
    updateSession(id, { lastPayload: { stale: true } });
    postToN8n.mockResolvedValue({ pending: true });
    const res = await step(id, { answers: {} });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ pending: true });
    expect(getSession(id)).toMatchObject({
      resumeUrl: null,
      lastPayload: null,
    });
  });

  it("maps a workflow business error to 422", async () => {
    postToN8n.mockResolvedValue({
      pending: false,
      workflowError: true,
      message: "nope",
    });
    const res = await step(liveSession(), { answers: {} });
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "nope" });
  });

  it("502s when the n8n call throws", async () => {
    postToN8n.mockRejectedValue(new Error("down"));
    const res = await step(liveSession(), { answers: {} });
    expect(res.status).toBe(502);
  });
});

describe("GET /:id/events (SSE)", () => {
  it("404s for an unknown session", async () => {
    const res = await sessions.request("/nope/events");
    expect(res.status).toBe(404);
  });

  it("replays a buffered payload and closes when the session is done", async () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });
    updateSession(id, { lastPayload: { result: "ok" }, done: true });
    const res = await sessions.request(`/${id}/events`);
    const text = await res.text();
    expect(text).toContain("event: step");
    expect(text).toContain('"replayed":true');
    expect(text).toContain("ok");
  });

  it("replays a workflow-error sentinel as a workflowError event", async () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });
    updateSession(id, {
      lastPayload: { __workflowError: true, __errorMessage: "kaboom" },
      done: true,
    });
    const res = await sessions.request(`/${id}/events`);
    const text = await res.text();
    expect(text).toContain('"workflowError":true');
    expect(text).toContain("kaboom");
  });

  it("delivers a live push to a connected subscriber", async () => {
    const id = liveSession(); // resumeUrl set, not done, lastPayload null
    const res = await sessions.request(`/${id}/events`);
    const reader = res.body!.getReader();
    const readP = reader.read();
    // Poll until the stream callback has registered its subscriber, rather than
    // racing a fixed sleep (flaky under coverage/CI load → publish() returns false).
    const deadline = Date.now() + 1000;
    while (!hasSubscriber(id)) {
      if (Date.now() > deadline) throw new Error("subscriber never registered");
      await new Promise((r) => setTimeout(r, 5));
    }
    const delivered = publish(id, {
      data: { live: 1 },
      resumeUrl: null,
      done: true,
    });
    const { value } = await readP;
    const text = new TextDecoder().decode(value);
    expect(delivered).toBe(true);
    expect(text).toContain("live");
    await reader.cancel();
  });
});
