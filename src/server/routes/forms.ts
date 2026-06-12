/**
 * routes/forms.ts — POST /api/forms/:slug/start
 *
 * Validates the form token, mints a session, fires the initial n8n webhook,
 * and returns the first result (or a pending indicator) to the browser.
 *
 * resumeUrl and the webhook URL are NEVER sent to the browser — they live
 * only in the SQLite session row.
 */

import { Hono } from "hono";
import { validateToken } from "../auth.ts";
import { resolveFormConfig, PUBLIC_BASE_URL } from "../config.ts";
import { createSession, updateSession } from "../db.ts";
import { postToN8n } from "../n8n.ts";

const forms = new Hono();

forms.post("/:slug/start", async (c) => {
  const slug = c.req.param("slug");

  // --- Token resolution: x-form-token header takes priority, then ?t= query ---
  const token =
    c.req.header("x-form-token") ??
    c.req.query("t") ??
    null;

  if (!validateToken(slug, token)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Resolve the webhook URL (token already validated, but we need the URL)
  const cfg = resolveFormConfig(slug);
  if (!cfg) {
    // Should not happen if validateToken passed, but guard defensively
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

  // Synchronous result — store resumeUrl + done, return data to browser
  updateSession(sessionId, {
    resumeUrl: result.resumeUrl,
    done: result.done,
  });

  return c.json({ sessionId, data: result.data, done: result.done });
});

export default forms;
