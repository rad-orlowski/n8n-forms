import path from "path";
import { defineConfig } from "vitest/config";
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
    passWithNoTests: true,
    setupFiles: ["./src/test/setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
      exclude: [
        // vendored / shadcn-generated — not our code to cover
        "src/components/tiptap-*/**",
        "src/components/ui/**",
        "src/hooks/**",
        "src/lib/tiptap-utils.ts",
        // test infrastructure
        "src/test/**",
        // type-only files
        "src/scss.d.ts",
        // build + config
        "vite.config.ts",
        "vitest.config.ts",
        "postcss.config.js",
        "tailwind.config.js",
      ],
    },
  },
});
