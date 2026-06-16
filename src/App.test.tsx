import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import App from "./App";

beforeEach(() => {
  // ThemeSwitcher reads localStorage and matchMedia; stub both for jsdom
  vi.stubGlobal("localStorage", {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

afterEach(() => vi.unstubAllGlobals());

function stub(forms: unknown[], rejected: unknown[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (String(url).includes("/api/forms"))
        return { ok: true, json: async () => ({ forms, rejected }) };
      return { ok: true, json: async () => ({ showExampleForms: true }) };
    }),
  );
}

describe("App console index", () => {
  it("lists fetched forms", async () => {
    window.location.hash = "#/";
    stub([{ slug: "a", title: "Alpha", pages: [{ fields: [] }] }]);
    render(<App />);
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
  });

  it("shows a banner when forms were rejected", async () => {
    window.location.hash = "#/";
    stub([], [{ file: "bad.form.json5", errors: ["pages: required"] }]);
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText(/failed to load/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/bad\.form\.json5/)).toBeInTheDocument();
  });
});
