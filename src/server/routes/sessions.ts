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
import { postToN8n, parseTimeout } from "../n8n.ts";
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
  let resumeUrlPath: string | undefined;
  let method: "GET" | "POST" = "POST";
  let timeout: number | false | undefined;
  try {
    const body = await c.req.json();
    const b = body as Record<string, unknown>;
    answers = b.answers ?? body;
    resumeUrlPath =
      typeof b.resumeUrlPath === "string" ? b.resumeUrlPath : undefined;
    if (b.method === "GET") method = "GET";
    timeout = parseTimeout(b.timeoutMs);
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const callbackUrl = `${PUBLIC_BASE_URL}/api/callback/${sessionId}`;

  let result;
  try {
    result = await postToN8n(
      session.resumeUrl,
      { answers, sessionId, callbackUrl },
      { resumeUrlPath, method, timeout },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to reach n8n: ${message}` }, 502);
  }

  if (result.pending) {
    // Clear resumeUrl AND the previously buffered payload: the prior step's
    // result has now been consumed (the client advanced and submitted this
    // step), so it must not be replayed when the browser re-opens SSE for the
    // fresh callback. resumeUrl + lastPayload are refreshed by the callback.
    updateSession(sessionId, { resumeUrl: null, lastPayload: null });
    return c.json({ pending: true });
  }

  // Workflow-level business error (n8n returned 2xx but __error: true)
  if (result.workflowError) {
    return c.json({ error: result.message }, 422);
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
      // Detect workflow-error sentinel written by callback.ts
      const p = session.lastPayload as Record<string, unknown>;
      const isErrorSentinel =
        typeof p === "object" && p !== null && p.__workflowError === true;

      await stream.writeSSE({
        event: "step",
        data: JSON.stringify({
          data: isErrorSentinel ? null : session.lastPayload,
          done: session.done,
          replayed: true,
          ...(isErrorSentinel && {
            workflowError: true,
            errorMessage:
              typeof p.__errorMessage === "string"
                ? p.__errorMessage
                : "The workflow reported an error.",
          }),
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
        stream
          .writeSSE({
            event: "step",
            data: JSON.stringify({
              data: event.data,
              done: event.done,
              ...(event.workflowError && {
                workflowError: true,
                errorMessage: event.errorMessage,
              }),
            } satisfies StepEventPayload),
          })
          .finally(resolve);
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
  /** Present when the workflow signalled __error: true in its callback */
  workflowError?: boolean;
  /** Workflow-supplied error message; only present when workflowError is true */
  errorMessage?: string;
}

export default sessions;
