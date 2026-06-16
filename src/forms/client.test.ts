import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useForms } from "./client";

afterEach(() => vi.unstubAllGlobals());

describe("useForms", () => {
  it("returns fetched forms + rejected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          forms: [{ slug: "a", title: "A", pages: [{ fields: [] }] }],
          rejected: [{ file: "bad.form.json5", errors: ["x"] }],
        }),
      })),
    );
    const { result } = renderHook(() => useForms());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.forms.map((f) => f.slug)).toEqual(["a"]);
    expect(result.current.rejected).toHaveLength(1);
  });

  it("degrades to empty list when /api/forms is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    const { result } = renderHook(() => useForms());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.forms).toEqual([]);
    expect(result.current.rejected).toEqual([]);
  });
});
