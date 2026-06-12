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
    // Two-terminal dev: vite serves the SPA (5173) and proxies /api/* to the
    // BFF (bun run dev:server, default :3000). Keeps the browser on one origin
    // so relative /api calls + SSE work without CORS. In production the BFF
    // serves the built SPA itself, so this proxy is dev-only.
    proxy: {
      "/api": {
        target: process.env.BFF_TARGET ?? "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
