// src/lib/sanitize.ts
import DOMPurify from "dompurify";

const ALLOWED_TAGS = ["b", "strong", "i", "em", "u", "a", "p", "br", "ul", "ol", "li", "span", "code", "blockquote"];
const ALLOWED_ATTR = ["href", "target", "rel"];

// Registered once at module load — do not move inside sanitizeHtml (hook would
// accumulate on every call). Enforces rel="noopener noreferrer" on any anchor
// that carries target="_blank" to prevent reverse-tabnabbing.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A" && node.hasAttribute("target")) {
    node.setAttribute("rel", "noopener noreferrer");
  }
});

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html ?? "", { ALLOWED_TAGS, ALLOWED_ATTR });
}
