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
import { postToN8n, parseTimeout } from "../n8n.ts";

const forms = new Hono();

forms.post("/:slug/start", async (c) => {
  const slug = c.req.param("slug");

  const cfg = resolveFormConfig(slug);
  if (!cfg) {
    return c.json({ error: "Form not configured" }, 404);
  }

  // Parse request body for answers (and optional resumeUrlPath / method)
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

  // Mint a new session
  const sessionId = crypto.randomUUID();
  createSession({ sessionId, formSlug: slug });

  const callbackUrl = `${PUBLIC_BASE_URL}/api/callback/${sessionId}`;

  // POST to n8n webhook
  let result;
  try {
    result = await postToN8n(
      cfg.webhookUrl,
      { answers, sessionId, callbackUrl },
      { resumeUrlPath, method, timeout },
    );
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
