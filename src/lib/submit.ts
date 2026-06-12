import ky, { HTTPError, TimeoutError } from "ky";

// ── shared types ────────────────────────────────────────────────────────────

/**
 * Returned by startForm() when n8n replied synchronously (no SSE needed).
 */
export interface StartResult {
  sessionId: string;
  /** n8n replied synchronously with step data. */
  pending: false;
  data: unknown;
  done: boolean;
}

/**
 * Returned by startForm() when n8n replied 202 — the caller must open SSE.
 */
export interface StartPending {
  sessionId: string;
  pending: true;
}

/** Returned by stepForm() — same shape as StartResult minus sessionId. */
export interface StepResult {
  pending: false;
  data: unknown;
  done: boolean;
}

export interface StepPending {
  pending: true;
}

/** A BFF error response (4xx / 5xx). */
export interface BffError {
  ok: false;
  status: number;
  /** Human-readable message from the BFF `{ error }` body, or a network description. */
  message: string;
}

export type StartResponse = StartResult | StartPending | BffError;
export type StepResponse = StepResult | StepPending | BffError;

// ── helpers ─────────────────────────────────────────────────────────────────

async function extractError(err: unknown): Promise<BffError> {
  if (err instanceof HTTPError) {
    let message = `HTTP ${err.response.status}`;
    try {
      const body = await err.response.json() as Record<string, unknown>;
      if (typeof body.error === "string") message = body.error;
    } catch {
      // non-JSON error body — keep the status line
    }
    return { ok: false, status: err.response.status, message };
  }
  if (err instanceof TimeoutError) {
    return { ok: false, status: 0, message: err.message };
  }
  return {
    ok: false,
    status: 0,
    message:
      err instanceof Error
        ? err.message
        : "Network request failed (could not reach BFF).",
  };
}

// ── public API ───────────────────────────────────────────────────────────────

/**
 * Submit page 0 of a form to the BFF.
 *
 * Token is forwarded as `x-form-token` header (preferred by the server) and
 * also appended as `?t=` query for fallback. No POST retry — double-trigger
 * risk on the n8n workflow remains as in the original design.
 */
export async function startForm(
  slug: string,
  answers: Record<string, unknown>,
  token: string | null,
): Promise<StartResponse> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers["x-form-token"] = token;

    const url = token
      ? `/api/forms/${slug}/start?t=${encodeURIComponent(token)}`
      : `/api/forms/${slug}/start`;

    const res = await ky.post(url, {
      json: { answers },
      headers,
      timeout: 15000,
    });

    const body = await res.json() as Record<string, unknown>;

    if (body.pending === true) {
      return { sessionId: body.sessionId as string, pending: true };
    }

    return {
      sessionId: body.sessionId as string,
      pending: false,
      data: body.data,
      done: Boolean(body.done),
    };
  } catch (err) {
    return extractError(err);
  }
}

/**
 * Submit subsequent wizard pages (page index ≥ 1) to the BFF.
 */
export async function stepForm(
  sessionId: string,
  answers: Record<string, unknown>,
): Promise<StepResponse> {
  try {
    const res = await ky.post(`/api/sessions/${sessionId}/step`, {
      json: { answers },
      timeout: 15000,
    });

    const body = await res.json() as Record<string, unknown>;

    if (body.pending === true) {
      return { pending: true };
    }

    return {
      pending: false,
      data: body.data,
      done: Boolean(body.done),
    };
  } catch (err) {
    return extractError(err);
  }
}

/**
 * Open an SSE connection to wait for an async n8n step result.
 *
 * Returns an EventSource. The caller should listen for `"step"` events and
 * close the source when `done` is true or on error. The BFF replays the
 * last buffered payload on reconnect (field `replayed: true` in the data).
 */
export function openEventStream(sessionId: string): EventSource {
  return new EventSource(`/api/sessions/${sessionId}/events`);
}
