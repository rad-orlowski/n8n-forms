/**
 * routes/forms.ts — POST /api/forms/:slug/start
 *
 * Mints a session, fires the initial n8n webhook, and returns the first
 * result (or a pending indicator) to the browser.
 *
 * resumeUrl and the webhook URL are NEVER sent to the browser — they live
 * only in the SQLite session row.
 */

import { Hono } from "hono";
import { resolveFormConfig, PUBLIC_BASE_URL } from "../config.ts";
import { createSession, updateSession } from "../db.ts";
import { postToN8n } from "../n8n.ts";

const forms = new Hono();

forms.post("/:slug/start", async (c) => {
  const slug = c.req.param("slug");

  const cfg = resolveFormConfig(slug);
  if (!cfg) {
    return c.json({ error: "Form not configured" }, 404);
  }

  // Parse request body for answers
  let answers: unknown;
  try {
    const body = await c.req.json();
    answers = (body as Record<string, unknown>).answers ?? body;
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  // Mint a new session
  const sessionId = crypto.randomUUID();
  createSession({ sessionId, formSlug: slug });

  const callbackUrl = `${PUBLIC_BASE_URL}/api/callback/${sessionId}`;

  // POST to n8n webhook
  let result;
  try {
    result = await postToN8n(cfg.webhookUrl, { answers, sessionId, callbackUrl });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: `Failed to reach n8n: ${message}` }, 502);
  }

  if (result.pending) {
    // n8n returned 202 — browser should open SSE to wait for callback
    return c.json({ sessionId, pending: true });
  }

  // Workflow-level business error (n8n returned 2xx but __error: true)
  if (result.workflowError) {
    return c.json({ error: result.message }, 422);
  }

  // Synchronous result — store resumeUrl + done, return data to browser
  updateSession(sessionId, {
    resumeUrl: result.resumeUrl,
    done: result.done,
  });

  return c.json({ sessionId, data: result.data, done: result.done });
});

export default forms;
