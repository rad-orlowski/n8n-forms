/**
 * src/server/dev.ts — unified single-server dev entry point.
 *
 * Runs one HTTP server on PORT that handles:
 *   /api/*   → Hono BFF (same routes as production)
 *   /*       → Vite dev middleware (HMR, hot reload, dev transforms)
 *
 * HMR WebSocket is attached to the same http.Server so the browser only
 * needs one connection target. No proxy config required.
 *
 * Usage:  bun --watch src/server/dev.ts
 */

import { createServer } from "node:http";
import { existsSync, readFileSync, watch } from "node:fs";
import { resolve } from "node:path";
import { createServer as createVite } from "vite";
import { getRequestListener } from "@hono/node-server";
import { app } from "./index.ts";
import { FORMS_DIR, PORT } from "./config.ts";
import { reloadForms } from "./forms-loader.ts";

const honoListener = getRequestListener(app.fetch);

// Create the http.Server shell first — Vite needs a reference to it so it can
// upgrade WebSocket connections for HMR on the same port.
const httpServer = createServer();

// Init Vite in middleware mode, handing it our http.Server for HMR.
const vite = await createVite({
  server: {
    middlewareMode: true,
    hmr: { server: httpServer },
  },
  appType: "spa",
});

// Route requests: /api/* → Hono, everything else → Vite.
// The `next` callback fires when Vite's middleware stack doesn't handle the
// request (e.g. the root "/" or any hash-router path). In that case we read
// index.html, let Vite transform it (injects HMR client, runs plugins), and
// send it as the SPA shell. This is the standard Vite middleware-mode pattern.
httpServer.on("request", (req, res) => {
  if (req.url?.startsWith("/api/")) {
    honoListener(req, res);
  } else {
    vite.middlewares(req, res, async () => {
      try {
        const url = req.url ?? "/";
        let html = readFileSync(resolve("index.html"), "utf-8");
        html = await vite.transformIndexHtml(url, html);
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html");
        res.end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        res.statusCode = 500;
        res.end((e as Error).message);
      }
    });
  }
});

httpServer.listen(PORT, () => {
  console.log(`Dev server: http://localhost:${PORT}`);
});

// Dev-only: re-validate forms when a definition changes — no restart needed.
if (existsSync(FORMS_DIR)) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  watch(FORMS_DIR, { recursive: true }, () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => reloadForms(), 150);
  });
  console.log(`[forms] watching ${FORMS_DIR} for changes (dev)`);
}
