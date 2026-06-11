import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // "./" base is required for file:// serving — all asset paths become relative
  base: "./",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Inline assets ≤ 100 KiB so the final html-inline pass has fewer external refs
    assetsInlineLimit: 100 * 1024,
  },
});
