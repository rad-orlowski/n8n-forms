/**
 * config.ts — env loading for the BFF server.
 *
 * Env var naming convention (mirrored in .env.example):
 *   WEBHOOK_<SLUG>      — n8n webhook URL for a form
 *   FORM_TOKEN_<SLUG>   — bearer token the browser must send to /start
 *   where <SLUG> is the form slug uppercased, non-alphanumeric→_
 *   e.g. "event-rsvp" → "EVENT_RSVP", "wizard-demo" → "WIZARD_DEMO"
 *
 * Also:
 *   PORT              — HTTP listen port (default 3000)
 *   PUBLIC_BASE_URL   — scheme+host+optional-port used to build callbackUrl
 *                       e.g. "https://forms.example.com" or "http://localhost:3000"
 */

/** Normalise a form slug to its env-var suffix. */
export function slugToEnvKey(slug: string): string {
  return slug.toUpperCase().replace(/[^A-Z0-9]/g, "_");
}

/** Resolved webhook + token for one form slug, or null if not configured. */
export interface FormConfig {
  webhookUrl: string;
  token: string;
}

/**
 * Resolve the webhook URL and form token for a given slug.
 * Returns null when either value is absent from the environment.
 */
export function resolveFormConfig(slug: string): FormConfig | null {
  const key = slugToEnvKey(slug);
  const webhookUrl = process.env[`WEBHOOK_${key}`];
  const token = process.env[`FORM_TOKEN_${key}`];
  if (!webhookUrl || !token) return null;
  return { webhookUrl, token };
}

/** HTTP listen port. */
export const PORT: number = Number(process.env.PORT ?? 3000);

/**
 * Base URL used when constructing callbackUrl.
 * Must NOT have a trailing slash.
 * Defaults to localhost for local dev — override in production.
 */
export const PUBLIC_BASE_URL: string = (
  process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`
).replace(/\/$/, "");
