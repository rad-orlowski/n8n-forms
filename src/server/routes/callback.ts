/**
 * routes/callback.ts — POST /api/callback/:id
 *
 * n8n calls this endpoint when an async workflow step completes.
 * Body: { data?: unknown, resumeUrl?: string, done?: boolean }
 *
 * Flow:
 *   1. Identify the session by :id (sessionId embedded in callbackUrl by BFF)
 *   2. Persist resumeUrl, data, and done flag to DB for SSE replay support
 *   3. Push the event to any connected SSE stream via the in-process emitter
 *   4. Return 204 No Content (n8n does not need a response body)
 *
 * sessionId correlation: when the BFF calls n8n it passes
 *   callbackUrl = `${PUBLIC_BASE_URL}/api/callback/${sessionId}`
 * n8n must POST to that URL when the step completes — the :id IS the sessionId.
 */

import type { Context } from "hono";
import { getSession, updateSession } from "../db.ts";
import { publish } from "../events.ts";

export async function callbackHandler(c: Context): Promise<Response> {
  const sessionId = c.req.param("id") ?? "";
  const session = getSession(sessionId);

  if (!session) {
    // Return 204 rather than 404 so n8n doesn't retry indefinitely
    return new Response(null, { status: 204 });
  }

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Detect workflow-level business error (__error: true in callback payload).
  // Strip the sentinel keys so they never reach the browser as raw data.
  const workflowError = body.__error === true;
  const errorMessage = workflowError
    ? (typeof body.message === "string" && body.message.trim()
        ? body.message.trim()
        : "The workflow reported an error.")
    : undefined;

  const data = workflowError ? null : (body.data ?? null);
  const resumeUrl = typeof body.resumeUrl === "string" ? body.resumeUrl : null;
  // A workflow error always ends the session.
  const done = workflowError ? true : Boolean(body.done ?? !resumeUrl);

  // For replay: store a sentinel so a browser that reconnects after missing the
  // live push still receives the error rather than a phantom success panel.
  const replayPayload = workflowError
    ? { __workflowError: true, __errorMessage: errorMessage }
    : data;

  // Persist before pushing — SSE replay needs current DB state
  updateSession(sessionId, { resumeUrl, lastPayload: replayPayload, done });

  // Push to any connected SSE subscriber; if none connected, the data is
  // buffered in DB and will be replayed when the browser reconnects.
  publish(sessionId, { data, resumeUrl, done, workflowError: workflowError || undefined, errorMessage });

  return new Response(null, { status: 204 });
}
