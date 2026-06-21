// src/lib/sanitize.test.ts
import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitize";

describe("sanitizeHtml", () => {
  it("preserves allowed formatting", () => {
    expect(sanitizeHtml("<b>hi</b> <a href='https://x.test'>link</a>")).toContain("<b>hi</b>");
  });
  it("strips script tags", () => {
    expect(sanitizeHtml("<script>alert(1)</script>safe")).not.toContain("<script>");
  });
  it("strips event handlers and disallowed tags", () => {
    const out = sanitizeHtml('<img src=x onerror="alert(1)"><b>ok</b>');
    expect(out).not.toContain("onerror");
    expect(out).not.toContain("<img");
    expect(out).toContain("<b>ok</b>");
  });
  it("adds rel=noopener noreferrer to target=_blank anchors", () => {
    const out = sanitizeHtml('<a href="https://x.test" target="_blank">link</a>');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('href="https://x.test"');
  });
});
