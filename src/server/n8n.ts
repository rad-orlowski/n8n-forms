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
import { readFileSync } from "fs";
import { get } from "es-toolkit/compat";

// ---------------------------------------------------------------------------
// Optional custom CA (for local dev with self-signed / mkcert certs).
// Set NODE_EXTRA_CA_CERTS in .env to the PEM path; ignored in production
// where n8n has a real certificate trusted by Bun's built-in CA store.
// ---------------------------------------------------------------------------
function loadCustomCA(): string | undefined {
  const caPath = process.env.NODE_EXTRA_CA_CERTS;
  if (!caPath) return undefined;
  try {
    return readFileSync(caPath, "utf8");
  } catch {
    console.warn(`[n8n] NODE_EXTRA_CA_CERTS path not readable: ${caPath}`);
    return undefined;
  }
}

// Pre-built ky instance with optional custom CA baked in.
// Constructed once at module load — no per-request allocation.
const n8nKy = ky.create({
  fetch: (() => {
    const ca = loadCustomCA();
    if (!ca) return fetch;
    const tlsInit = { tls: { ca } } as RequestInit;
    return (input: Parameters<typeof fetch>[0], init?: RequestInit) =>
      fetch(input, { ...init, ...tlsInit });
  })(),
  retry: 0,
  timeout: 30_000,
});

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
  workflowError?: false;
  data: unknown;
  resumeUrl: string | null;
  done: boolean;
}

/** Returned when n8n replies 202 (async / callback path). */
export interface N8nPendingResult {
  pending: true;
}

/**
 * Returned when n8n replies 2xx but the payload contains `__error: true`.
 * This is a workflow-level business error — the HTTP call succeeded, but the
 * workflow deliberately signalled a failure.  The BFF surfaces this as a 422
 * so the form can show the workflow's own error message.
 */
export interface N8nWorkflowErrorResult {
  pending: false;
  workflowError: true;
  message: string;
}

export type N8nResult =
  | N8nSyncResult
  | N8nPendingResult
  | N8nWorkflowErrorResult;

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
 * Coerce a client-supplied `timeoutMs` body value into a ky timeout override.
 *   - `"indefinite"`        → `false` (no timeout)
 *   - a positive finite num → that many ms
 *   - anything else / absent → `undefined` (fall back to the module default)
 * The value is untrusted client input, so it is validated, not trusted.
 */
export function parseTimeout(raw: unknown): number | false | undefined {
  if (raw === "indefinite") return false;
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) return raw;
  return undefined;
}

/** Per-call options for {@link postToN8n}. */
export interface PostToN8nOptions {
  /** Dot-path into the n8n reply where the resumeUrl lives; falls back to top-level `resumeUrl`. */
  resumeUrlPath?: string;
  /**
   * HTTP method used to call n8n. Defaults to "POST" (the standard contract,
   * carrying the answers/sessionId/callbackUrl body). Use "GET" for trigger
   * webhooks that take no input (e.g. a page-0 "load" step) — the payload is
   * not sent in that case.
   */
  method?: "GET" | "POST";
  /**
   * Per-call timeout (ms) overriding the module default. `false` disables the
   * timeout entirely (wait indefinitely for n8n). Origin: the form/page
   * `timeoutMs` resolved client-side and forwarded in the request body.
   */
  timeout?: number | false;
}

/**
 * Call `targetUrl` with the given payload.
 * `targetUrl` is either:
 *   - the initial webhook URL (resolved from WEBHOOK_<SLUG> env var)
 *   - a subsequent resumeUrl (n8n Wait-node endpoint)
 *
 * Defaults to POST; pass `method: "GET"` for input-less trigger webhooks
 * (the body is omitted for GET).
 *
 * Throws N8nCallError or N8nNetworkError on failure.
 */
export async function postToN8n(
  targetUrl: string,
  payload: N8nPayload,
  options: PostToN8nOptions = {},
): Promise<N8nResult> {
  const { resumeUrlPath, method = "POST", timeout } = options;
  // Only spread `timeout` when explicitly set — passing `undefined` would
  // override the n8nKy.create() default rather than fall back to it.
  const timeoutOpt = timeout !== undefined ? { timeout } : {};
  let response: Response;
  try {
    response =
      method === "GET"
        ? await n8nKy.get(targetUrl, timeoutOpt)
        : await n8nKy.post(targetUrl, { json: payload, ...timeoutOpt });
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

  const obj =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};
  // Support both bare object { ... } and array-wrapped [{ ... }] response shapes
  const payload0 =
    Array.isArray(body) && body.length > 0 && typeof body[0] === "object"
      ? (body[0] as Record<string, unknown>)
      : obj;

  // Workflow-level business error: n8n returned 2xx but signalled __error: true.
  // The form will show the workflow's own message rather than a success panel.
  if (payload0.__error === true) {
    const message =
      typeof payload0.message === "string" && payload0.message.trim()
        ? payload0.message.trim()
        : "The workflow reported an error.";
    return { pending: false, workflowError: true, message };
  }

  // If the workflow explicitly returned a `data` key, use it.
  // Otherwise expose the entire payload (minus BFF-internal keys) so form
  // response panels can reference any top-level n8n field directly.
  const INTERNAL_KEYS = new Set(["resumeUrl", "done", "data"]);
  const rest = Object.fromEntries(
    Object.entries(payload0).filter(([k]) => !INTERNAL_KEYS.has(k)),
  );
  const data: unknown =
    "data" in payload0
      ? payload0.data
      : Object.keys(rest).length > 0
        ? rest
        : null;

  // Resolve resumeUrl: use dot-path when provided, otherwise fall back to
  // the top-level `resumeUrl` field (standard contract).
  const resolvedResume =
    resumeUrlPath != null ? get(payload0, resumeUrlPath) : payload0.resumeUrl;
  const resumeUrl = typeof resolvedResume === "string" ? resolvedResume : null;

  return {
    pending: false,
    data,
    resumeUrl,
    done: Boolean(payload0.done ?? !resumeUrl),
  };
}
