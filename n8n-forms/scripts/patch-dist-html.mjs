#!/usr/bin/env node
// scripts/patch-dist-html.mjs
// Removes external-URL link tags from dist/index.html before html-inline runs.
// html-inline tries to resolve all href/src relative to dist/, so external
// URLs and missing assets (favicon.svg) cause ENOENT failures.

import { readFileSync, writeFileSync } from "fs";

const [, , filePath] = process.argv;
if (!filePath) {
  console.error("Usage: patch-dist-html.mjs <path-to-index.html>");
  process.exit(1);
}

let html = readFileSync(filePath, "utf8");

// Drop Google Fonts preconnect + stylesheet links (may span multiple lines)
html = html.replace(/<link\s[^>]*fonts\.gstatic\.com[^>]*>/g, "");
html = html.replace(/<link\s[^>]*fonts\.googleapis\.com[\s\S]*?>/g, "");

// Drop favicon link — favicon.svg is in /public, not copied to dist/ assets
html = html.replace(/<link[^>]*rel="icon"[^>]*>/g, "");

writeFileSync(filePath, html);
console.log("Patched:", filePath);
