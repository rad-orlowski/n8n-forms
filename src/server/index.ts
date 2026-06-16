/**
 * src/server/index.ts — Hono BFF entry point.
 *
 * Route layout:
 *   GET  /api/config                  → client-readable runtime config
 *   POST /api/forms/:slug/start       → routes/forms.ts
 *   POST /api/sessions/:id/step       → routes/sessions.ts
 *   GET  /api/sessions/:id/events     → routes/sessions.ts
 *   POST /api/callback/:id            → routes/sessions.ts (callback handler)
 *   /*                                → serves built SPA from dist/
 *                                       (SPA fallback to dist/index.html)
 *
 * The dist/ directory may not exist during development — static mount is
 * guarded to prevent a boot-time crash when dist/ is absent.
 */

import { existsSync } from "node:fs";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { PORT, SHOW_EXAMPLE_FORMS } from "./config.ts";
import formsRouter from "./routes/forms.ts";
import sessionsRouter from "./routes/sessions.ts";
import { callbackHandler } from "./routes/callback.ts";

const app = new Hono();

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------

// GET /api/config — non-secret runtime config the SPA reads on load. Holds no
// webhook URLs or secrets; only display toggles resolved from server env.
app.get("/api/config", (c) => c.json({ showExampleForms: SHOW_EXAMPLE_FORMS }));

app.route("/api/forms", formsRouter);
app.route("/api/sessions", sessionsRouter);

// POST /api/callback/:id — n8n posts here with async results.
// Kept at a clean top-level path separate from /api/sessions.
app.post("/api/callback/:id", callbackHandler);

// ---------------------------------------------------------------------------
// Static SPA serving (guarded — dist/ may not exist during development)
// ---------------------------------------------------------------------------

const DIST_EXISTS = existsSync("./dist");

if (DIST_EXISTS) {
  // Hashed assets (JS/CSS/fonts/images) — cache-safe
  app.use("/assets/*", serveStatic({ root: "./dist" }));
  // Other static files (favicon, icons, etc.)
  app.use("/favicon*", serveStatic({ root: "./dist" }));
  app.use("/icons*", serveStatic({ root: "./dist" }));
  // SPA fallback: all non-/api GET requests serve index.html for hash routing
  app.get("*", serveStatic({ path: "./dist/index.html" }));
} else {
  // dist/ absent — return a helpful placeholder rather than crashing
  app.get("*", (c) => {
    return c.html(
      `<!DOCTYPE html><html><body>` +
        `<p>SPA not built yet. Run <code>bun run build</code> then restart the server.</p>` +
        `</body></html>`,
      503,
    );
  });
}

// ---------------------------------------------------------------------------
// Start the server (Bun-native export — compatible with `bun src/server/index.ts`)
// ---------------------------------------------------------------------------

export default {
  port: PORT,
  fetch: app.fetch,
};

// Export the app instance for testing
export { app };
