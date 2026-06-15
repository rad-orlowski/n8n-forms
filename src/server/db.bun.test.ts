import { describe, expect, it } from "bun:test";
import { createSession, getSession, updateSession } from "./db.ts";

// Run with DB_PATH=:memory: (see the `test:server` script) so this never
// touches the on-disk sessions.db. Each test uses a unique sessionId.
let counter = 0;
const newId = () => `test-session-${++counter}`;

describe("createSession", () => {
  it("inserts a row with sane defaults", () => {
    const id = newId();
    const session = createSession({ sessionId: id, formSlug: "contact" });
    expect(session).toMatchObject({
      sessionId: id,
      formSlug: "contact",
      resumeUrl: null,
      lastPayload: null,
      done: false,
    });
    expect(typeof session.createdAt).toBe("string");
    expect(session.updatedAt).toBe(session.createdAt);
  });
});

describe("getSession", () => {
  it("returns null for an unknown id", () => {
    expect(getSession("does-not-exist")).toBeNull();
  });

  it("round-trips a created session", () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "rsvp" });
    expect(getSession(id)).toMatchObject({
      sessionId: id,
      formSlug: "rsvp",
      done: false,
    });
  });
});

describe("updateSession", () => {
  it("persists resumeUrl, JSON lastPayload and the done flag", () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });
    updateSession(id, {
      resumeUrl: "http://n8n/resume",
      lastPayload: { step: 1 },
      done: false,
    });
    const after = getSession(id);
    expect(after).toMatchObject({
      resumeUrl: "http://n8n/resume",
      lastPayload: { step: 1 },
      done: false,
    });
  });

  it("preserves unspecified fields on a partial patch", () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });
    updateSession(id, {
      resumeUrl: "http://n8n/a",
      lastPayload: { keep: true },
    });
    updateSession(id, { done: true }); // only flips done
    expect(getSession(id)).toMatchObject({
      resumeUrl: "http://n8n/a",
      lastPayload: { keep: true },
      done: true,
    });
  });

  it("clears lastPayload when explicitly set to null", () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });
    updateSession(id, { lastPayload: { tmp: 1 } });
    updateSession(id, { lastPayload: null });
    expect(getSession(id)?.lastPayload).toBeNull();
  });

  it("normalises an explicit undefined resumeUrl to null", () => {
    const id = newId();
    createSession({ sessionId: id, formSlug: "wizard" });
    updateSession(id, { resumeUrl: null });
    expect(getSession(id)?.resumeUrl).toBeNull();
  });

  it("throws for an unknown session", () => {
    expect(() => updateSession("missing", { done: true })).toThrow(
      /Session not found/,
    );
  });
});
