/**
 * config.ts — env loading for the BFF server.
 *
 * Env var naming convention (mirrored in .env.example):
 *   WEBHOOK_<SLUG>      — n8n webhook URL for a form
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

/** Resolved webhook URL for one form slug, or null if not configured. */
export interface FormConfig {
  webhookUrl: string;
}

/**
 * Resolve the webhook URL for a given slug.
 * Returns null when WEBHOOK_<SLUG> is absent from the environment.
 */
export function resolveFormConfig(slug: string): FormConfig | null {
  const key = slugToEnvKey(slug);
  const webhookUrl = process.env[`WEBHOOK_${key}`];
  if (!webhookUrl) return null;
  return { webhookUrl };
}

/** HTTP listen port. */
export const PORT: number = Number(process.env.PORT ?? 3000);

/**
 * Whether example/demo forms (those under forms/examples/) are shown in the
 * console. Defaults to true — set SHOW_EXAMPLE_FORMS=false in .env to hide them
 * without deleting the example definitions. Any value other than a falsy string
 * ("false", "0", "no", "off", "") counts as enabled.
 */
export const SHOW_EXAMPLE_FORMS: boolean = (() => {
  const raw = process.env.SHOW_EXAMPLE_FORMS;
  if (raw == null) return true; // default: show examples
  return !["false", "0", "no", "off", ""].includes(raw.trim().toLowerCase());
})();

/**
 * Base URL used when constructing callbackUrl.
 * Must NOT have a trailing slash.
 * Defaults to localhost for local dev — override in production.
 */
export const PUBLIC_BASE_URL: string = (
  process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`
).replace(/\/$/, "");
