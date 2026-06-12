/**
 * routes/sessions.ts
 *
 *   POST /api/sessions/:id/step      — submit answers for the next wizard page
 *   GET  /api/sessions/:id/events    — SSE stream for async n8n callbacks
 *
 * POST /api/callback/:id is handled in routes/callback.ts and mounted in index.ts.
 *
 * resumeUrl is stored only in the DB and never forwarded to the browser.
 * sessionId correlation: the BFF embeds sessionId in callbackUrl when
 * calling n8n, and n8n must echo it back as the :id path segment when
 * calling /api/callback/:id.
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { getSession, updateSession } from "../db.ts";
import { postToN8n } from "../n8n.ts";
import { subscribe, type SseEvent } from "../events.ts";
import { PUBLIC_BASE_URL } from "../config.ts";

const sessions = new Hono();

// ---------------------------------------------------------------------------
// POST /api/sessions/:id/step
// ---------------------------------------------------------------------------
sessions.post("/:id/step", async (c) => {
  const sessionId = c.req.param("id");
  const session = getSession(sessionId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }
  if (session.done) {
    return c.json({ error: "Session is already complete" }, 409);
  }
  if (!session.resumeUrl) {
    return c.json({ error: "No resume URL available for this session" }, 409);
  }

  let answers: unknown;
  try {
    const body = await c.req.json();
    answers = (body as Record<string, unknown>).answers ?? body;
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const callbackUrl = `${PUBLIC_BASE_URL}/api/callback/${sessionId}`;

  let result;
  try {
    result = await postToN8n(session.resumeUrl, { answers, sessionId, callbackUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to reach n8n: ${message}` }, 502);
  }

  if (result.pending) {
    // Clear the resumeUrl optimistically; it will be refreshed by the callback
    updateSession(sessionId, { resumeUrl: null });
    return c.json({ pending: true });
  }

  // Sync result
  updateSession(sessionId, {
    resumeUrl: result.resumeUrl,
    lastPayload: result.data,
    done: result.done,
  });

  return c.json({ data: result.data, done: result.done });
});

// ---------------------------------------------------------------------------
// GET /api/sessions/:id/events  (SSE)
// ---------------------------------------------------------------------------
sessions.get("/:id/events", (c) => {
  const sessionId = c.req.param("id");
  const session = getSession(sessionId);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return streamSSE(c, async (stream) => {
    // Replay buffered payload for reconnect support
    if (session.lastPayload !== null) {
      await stream.writeSSE({
        event: "step",
        data: JSON.stringify({
          data: session.lastPayload,
          done: session.done,
          replayed: true,
        } satisfies StepEventPayload),
        id: "replay",
      });
      if (session.done) {
        // No more events expected; close immediately after replay
        return;
      }
    }

    // Await a live push from the callback handler
    await new Promise<void>((resolve) => {
      const push = (event: SseEvent) => {
        stream.writeSSE({
          event: "step",
          data: JSON.stringify({
            data: event.data,
            done: event.done,
          } satisfies StepEventPayload),
        }).finally(resolve);
      };

      const unsubscribe = subscribe(sessionId, push);

      stream.onAbort(() => {
        unsubscribe();
        resolve();
      });
    });
  });
});

// ---------------------------------------------------------------------------
// Shared payload type (keeps SSE event shape consistent)
// ---------------------------------------------------------------------------
interface StepEventPayload {
  data: unknown;
  done: boolean;
  replayed?: boolean;
}

export default sessions;
