import path from "path";
import { defineConfig, configDefaults } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    // Vitest runs under Node and cannot import Bun-runtime modules
    // (`bun:sqlite`, `hono/bun`). Those files — db.ts, index.ts, dev.ts and
    // the route handlers — are covered by the separate `bun test` suite (see
    // bunfig.toml + src/server/**/*.bun.test.ts). Exclude the Bun specs so
    // vitest never tries to load them.
    exclude: [...configDefaults.exclude, "src/server/**/*.bun.test.ts"],
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      // Only the modules vitest is responsible for. The Bun-runtime server
      // files (db.ts, index.ts, dev.ts, routes/*) and the React UI (deferred
      // to a later pass) are intentionally absent: an `include` allowlist
      // means they are neither measured nor counted against the threshold by
      // this runner. Add the UI surface here when the component pass lands.
      include: [
        "src/lib/utils.ts",
        "src/lib/schema.ts",
        "src/lib/submit.ts",
        "src/lib/expr.ts",
        "src/lib/resolve-fields.ts",
        "src/server/config.ts",
        "src/server/events.ts",
        "src/server/n8n.ts",
      ],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
