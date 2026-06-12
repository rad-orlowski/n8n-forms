import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    // Single-server dev (bun dev): Vite runs in middleware mode inside the Hono
    // BFF (src/server/dev.ts). No proxy needed — /api/* and SPA both served
    // from the same port. If you run `bun run dev:vite` for SPA-only work,
    // re-add a proxy here pointing at your BFF port.
  },
});
