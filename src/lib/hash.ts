/**
 * Hash-route parsing helpers shared by `App` and its tests.
 *
 * The app uses hash routing (`#/<slug>?<query>`). These pure functions split the
 * hash into its slug and query parts; kept out of `App.tsx` so that component
 * file only exports a component (react-refresh / fast-refresh constraint).
 */

/**
 * Returns the slug portion of the URL hash (the part after `#/`, before `?`).
 *
 * Examples:
 *   #/contact      → "contact"
 *   #/act?opp=o1   → "act"
 *   #/             → ""
 */
export function parseHash(): string {
  const hash = window.location.hash.replace(/^#\/?/, ""); // strip leading "#/"
  const qIdx = hash.indexOf("?");
  return qIdx === -1 ? hash : hash.slice(0, qIdx);
}

/**
 * Returns the query params of the URL hash (the part after `?`) as a flat map.
 * Feeds `FieldDef.prefillFromQuery` so a deep-link like `#/act?opp=123` can seed
 * a field value.
 *
 * Examples:
 *   #/act?opp=o1&foo=bar → { opp: "o1", foo: "bar" }
 *   #/act               → {}
 */
export function parseHashQuery(): Record<string, string> {
  const qIdx = window.location.hash.indexOf("?");
  if (qIdx === -1) return {};
  return Object.fromEntries(
    new URLSearchParams(window.location.hash.slice(qIdx + 1)).entries(),
  );
}
