/**
 * n8n.ts — proxy helper for n8n webhook/resume calls.
 *
 * POST contract sent to n8n:
 *   { answers: unknown, sessionId: string, callbackUrl: string }
 *
 * n8n reply contract (see docs/n8n-workflow-contract.md):
 *   HTTP 202           → workflow accepted, will call back asynchronously
 *   Other 2xx + body   → { resumeUrl?: string, done?: boolean, data?: unknown }
 *
 * resumeUrl is the n8n Wait-node URL for the next step.  It is stored
 * server-side and NEVER forwarded to the browser.
 *
 * NO auto-retry — mirrors src/lib/submit.ts rationale: a retry on a
 * webhook trigger risks double-executing the workflow.
 */

import ky, { HTTPError } from "ky";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface N8nPayload {
  answers: unknown;
  sessionId: string;
  callbackUrl: string;
}

/** Returned when n8n replies synchronously with a body. */
export interface N8nSyncResult {
  pending: false;
  data: unknown;
  resumeUrl: string | null;
  done: boolean;
}

/** Returned when n8n replies 202 (async / callback path). */
export interface N8nPendingResult {
  pending: true;
}

export type N8nResult = N8nSyncResult | N8nPendingResult;

/** Typed error thrown when n8n returns a non-2xx response. */
export class N8nCallError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "N8nCallError";
    this.status = status;
  }
}

/** Typed error thrown on network-level failure (no response). */
export class N8nNetworkError extends Error {
  readonly cause: unknown;
  constructor(cause: unknown) {
    super("Network error calling n8n");
    this.name = "N8nNetworkError";
    this.cause = cause;
  }
}

// ---------------------------------------------------------------------------
// Core proxy helper
// ---------------------------------------------------------------------------

/**
 * POST `targetUrl` with the given payload.
 * `targetUrl` is either:
 *   - the initial webhook URL (resolved from WEBHOOK_<SLUG> env var)
 *   - a subsequent resumeUrl (n8n Wait-node endpoint)
 *
 * Throws N8nCallError or N8nNetworkError on failure.
 */
export async function postToN8n(
  targetUrl: string,
  payload: N8nPayload
): Promise<N8nResult> {
  let response: Response;
  try {
    response = await ky.post(targetUrl, {
      json: payload,
      // No retry — double-trigger risk is unacceptable for webhook workflows.
      retry: 0,
      // 30-second timeout; long-running workflows should use the 202/callback path.
      timeout: 30_000,
    });
  } catch (err) {
    if (err instanceof HTTPError) {
      const status = err.response.status;
      throw new N8nCallError(status, `n8n returned HTTP ${status}`);
    }
    throw new N8nNetworkError(err);
  }

  if (response.status === 202) {
    // Workflow accepted, result will arrive via POST /api/callback/:sessionId
    return { pending: true };
  }

  // 2xx with body — parse and return
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    // n8n returned 2xx but no JSON body — treat as done with no data
    return { pending: false, data: null, resumeUrl: null, done: true };
  }

  const obj = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  // Support both bare object { ... } and array-wrapped [{ ... }] response shapes
  const payload0 =
    Array.isArray(body) && body.length > 0 && typeof body[0] === "object"
      ? (body[0] as Record<string, unknown>)
      : obj;

  return {
    pending: false,
    data: payload0.data ?? null,
    resumeUrl: typeof payload0.resumeUrl === "string" ? payload0.resumeUrl : null,
    done: Boolean(payload0.done ?? !payload0.resumeUrl),
  };
}
