import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { createSession, getSession } from "../db.ts";
import { subscribe, type SseEvent } from "../events.ts";
import { callbackHandler } from "./callback.ts";

const app = new Hono();
app.post("/api/callback/:id", callbackHandler);

let counter = 0;
const newId = () => `cb-session-${++counter}`;

function callback(id: string, body: unknown) {
  return app.request(`/api/callback/${id}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("callbackHandler", () => {
  it("204s (no retry) for an unknown session", async () => {
    const res = await callback("missing", { data: {} });
    expect(res.status).toBe(204);
  });

  it("400s on an invalid JSON body", async () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });
    const res = await callback(id, "not json");
    expect(res.status).toBe(400);
  });

  it("persists data + resumeUrl and pushes to a subscriber", async () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });

    let pushed: SseEvent | undefined;
    const off = subscribe(id, (e) => (pushed = e));

    const res = await callback(id, { data: { ticket: "T-1" }, resumeUrl: "http://n8n/next", done: false });
    expect(res.status).toBe(204);
    expect(getSession(id)).toMatchObject({
      resumeUrl: "http://n8n/next",
      lastPayload: { ticket: "T-1" },
      done: false,
    });
    expect(pushed).toMatchObject({ data: { ticket: "T-1" }, resumeUrl: "http://n8n/next", done: false });
    off();
  });

  it("infers done when no resumeUrl is supplied", async () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });
    await callback(id, { data: { final: true } });
    expect(getSession(id)).toMatchObject({ done: true, lastPayload: { final: true } });
  });

  it("stores a sentinel and ends the session on a workflow error", async () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });

    let pushed: SseEvent | undefined;
    const off = subscribe(id, (e) => (pushed = e));

    const res = await callback(id, { __error: true, message: "  workflow boom  " });
    expect(res.status).toBe(204);
    expect(getSession(id)).toMatchObject({
      done: true,
      lastPayload: { __workflowError: true, __errorMessage: "workflow boom" },
    });
    expect(pushed).toMatchObject({ workflowError: true, errorMessage: "workflow boom", data: null });
    off();
  });

  it("falls back to a default error message when none is provided", async () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });
    await callback(id, { __error: true });
    expect(getSession(id)).toMatchObject({
      lastPayload: { __workflowError: true, __errorMessage: "The workflow reported an error." },
    });
  });
});
