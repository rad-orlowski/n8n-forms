import ky, { HTTPError, TimeoutError } from "ky";

export interface SubmitResult {
  ok: boolean;
  /** HTTP status, or 0 for a network/timeout/CORS failure. */
  status: number;
  /** Raw response body (or an error message for network failures). */
  body: string;
}

/**
 * POST the collected form values to an n8n webhook as JSON.
 *
 * Note on local use: when the page is opened via file:// its origin is "null",
 * so the n8n Webhook node must have CORS "Allowed Origins" set to `*`
 * (or be served from an origin you whitelist). A blocked request surfaces here
 * as a TimeoutError or network error -> { ok:false, status:0 }.
 */
export async function postToWebhook(
  url: string,
  values: Record<string, unknown>,
  options?: { headers?: Record<string, string> }
): Promise<SubmitResult> {
  try {
    const res = await ky.post(url, {
      json: values,
      timeout: 10000,
      headers: options?.headers,
      // retry: { limit: 2, methods: ["post"] }  // WARNING: retrying a POST can double-trigger the n8n workflow if the first request succeeded but the response was lost. Only enable per-webhook when safe (idempotent).
    });
    const body = await res.text();
    return { ok: true, status: res.status, body };
  } catch (err) {
    if (err instanceof HTTPError) {
      const body = await err.response.text().catch(() => "");
      return { ok: false, status: err.response.status, body };
    }
    if (err instanceof TimeoutError) {
      return { ok: false, status: 0, body: err.message };
    }
    // Network error, CORS block, or other unexpected throw
    return {
      ok: false,
      status: 0,
      body:
        err instanceof Error
          ? err.message
          : "Network request failed (check the webhook URL and n8n CORS settings).",
    };
  }
}
