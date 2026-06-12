/**
 * events.ts — in-process SSE subscriber registry.
 *
 * When a browser opens GET /api/sessions/:id/events, the route handler
 * registers a push callback here.  When POST /api/callback/:id arrives,
 * it looks up the callback and pushes the event.
 *
 * One session → at most one SSE connection (latest registration wins;
 * the previous stream is superseded by the new one on reconnect).
 */

export interface SseEvent {
  /** n8n-supplied data for the next page/result rendering */
  data: unknown;
  /** Updated resumeUrl for the next step (stored server-side; not forwarded) */
  resumeUrl: string | null;
  /** True when the workflow has finished */
  done: boolean;
}

type SsePushFn = (event: SseEvent) => void;

const subscribers = new Map<string, SsePushFn>();

/** Register a push function for a session.  Returns an unsubscribe handle. */
export function subscribe(sessionId: string, push: SsePushFn): () => void {
  subscribers.set(sessionId, push);
  return () => {
    // Only remove if still the same subscriber (guard against race on reconnect)
    if (subscribers.get(sessionId) === push) {
      subscribers.delete(sessionId);
    }
  };
}

/**
 * Push an event to the registered SSE subscriber for a session.
 * Returns true if a subscriber was found, false otherwise (callback arrived
 * before the browser opened the SSE stream — the payload is stored in DB
 * for replay on next connect).
 */
export function publish(sessionId: string, event: SseEvent): boolean {
  const push = subscribers.get(sessionId);
  if (!push) return false;
  push(event);
  return true;
}
