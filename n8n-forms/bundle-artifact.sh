#!/usr/bin/env bash
# bundle-artifact.sh
# Produces a single self-contained forms.html suitable for local file:// use.
# Usage: ./bundle-artifact.sh [output-path]
#   output-path defaults to ./forms.html

set -euo pipefail

OUT="${1:-forms.html}"
DIST="dist"

echo "==> Building with Vite…"
bunx --bun vite build

echo "==> Patching dist/index.html for offline file:// use…"
# html-inline resolves all href/src relative to DIST; external URLs and
# missing assets (favicon) cause ENOENT failures.
DIST_HTML="${DIST}/index.html"
node scripts/patch-dist-html.mjs "${DIST_HTML}"

echo "==> Inlining assets into ${OUT}…"
bunx html-inline -i "${DIST_HTML}" -o "${OUT}" -b "${DIST}"

echo "==> Done: ${OUT} ($(du -sh "${OUT}" | cut -f1))"
