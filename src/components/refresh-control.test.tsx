// Component tests for the Refresh control on single-page GET forms.
// Run via vitest (jsdom), not bun test.
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { FormShell } from "./FormShell";
import { defineForm } from "@/lib/schema";

// Hoist mocks so vi.mock() factory can reference them.
const { startFormMock, openEventStreamMock } = vi.hoisted(() => ({
  startFormMock: vi.fn(),
  openEventStreamMock: vi.fn(),
}));

vi.mock("@/lib/submit", () => ({
  startForm: startFormMock,
  stepForm: vi.fn(),
  openEventStream: openEventStreamMock,
}));

const form = defineForm({
  slug: "data-table",
  title: "Data table",
  pages: [{ method: "GET", fields: [{ type: "description", content: "Load" }] }],
  response: {
    header: { style: "none" },
    fields: [{ key: "items", format: "table", columns: [{ key: "name", label: "Name" }] }],
  },
});

describe("Refresh control", () => {
  beforeEach(() => {
    startFormMock.mockReset();
    openEventStreamMock.mockReset();
  });

  it("re-runs the page-0 GET and updates the table", async () => {
    startFormMock
      .mockResolvedValueOnce({ sessionId: "s1", pending: false, data: { items: [{ name: "First" }] }, done: true })
      .mockResolvedValueOnce({ sessionId: "s2", pending: false, data: { items: [{ name: "Second" }] }, done: true });

    render(<FormShell schema={form} />);
    fireEvent.click(screen.getByRole("button", { name: /Submit|Load/i }));
    await screen.findByText("First");
    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));
    await waitFor(() => expect(screen.getByText("Second")).toBeInTheDocument());
    expect(startFormMock).toHaveBeenCalledTimes(2);
  });

  it("shows error state when refresh hits a BFF error", async () => {
    // Initial load succeeds
    startFormMock
      .mockResolvedValueOnce({ sessionId: "s1", pending: false, data: { items: [{ name: "First" }] }, done: true })
      // Refresh returns a BffError
      .mockResolvedValueOnce({ ok: false, status: 500, message: "Internal server error" });

    render(<FormShell schema={form} />);
    fireEvent.click(screen.getByRole("button", { name: /Submit|Load/i }));
    await screen.findByText("First");

    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));

    // Should transition to error state showing the error message
    await waitFor(() => expect(screen.getByText(/Internal server error/i)).toBeInTheDocument());
    expect(startFormMock).toHaveBeenCalledTimes(2);
  });

  it("opens the SSE event stream when refresh returns pending", async () => {
    // Fake EventSource that lets us trigger events manually
    const capturedListeners: Record<string, (e: MessageEvent) => void> = {};
    const fakeEs = {
      addEventListener: vi.fn((type: string, handler: (e: MessageEvent) => void) => {
        capturedListeners[type] = handler;
      }),
      close: vi.fn(),
      onerror: null as ((e: Event) => void) | null,
    };
    openEventStreamMock.mockReturnValue(fakeEs);

    // Initial load succeeds synchronously
    startFormMock
      .mockResolvedValueOnce({ sessionId: "s1", pending: false, data: { items: [{ name: "First" }] }, done: true })
      // Refresh returns pending → SSE path
      .mockResolvedValueOnce({ sessionId: "s2", pending: true });

    render(<FormShell schema={form} />);
    fireEvent.click(screen.getByRole("button", { name: /Submit|Load/i }));
    await screen.findByText("First");

    fireEvent.click(screen.getByRole("button", { name: /Refresh/i }));

    // openEventStream must be called with the session id from the pending result
    await waitFor(() => expect(openEventStreamMock).toHaveBeenCalledWith("s2"));

    // The pending phase shows the spinner
    await waitFor(() => expect(screen.getByText(/Waiting for workflow response/i)).toBeInTheDocument());

    // Simulate the SSE callback delivering the updated data
    capturedListeners["step"]({
      data: JSON.stringify({ data: { items: [{ name: "Updated" }] }, done: true }),
    } as MessageEvent);

    // The panel should now show the updated data
    await waitFor(() => expect(screen.getByText("Updated")).toBeInTheDocument());
  });

  it("sets aria-busy=true on the Refresh button while a refresh is in flight", async () => {
    // Make startForm hang so refresh stays in-flight long enough to inspect
    let resolveRefresh!: (v: unknown) => void;
    const hangingPromise = new Promise((res) => { resolveRefresh = res; });

    startFormMock
      .mockResolvedValueOnce({ sessionId: "s1", pending: false, data: { items: [{ name: "First" }] }, done: true })
      .mockReturnValueOnce(hangingPromise);

    render(<FormShell schema={form} />);
    fireEvent.click(screen.getByRole("button", { name: /Submit|Load/i }));
    await screen.findByText("First");

    const refreshBtn = screen.getByRole("button", { name: /Refresh/i });

    // Before refresh: aria-busy should be false
    expect(refreshBtn).toHaveAttribute("aria-busy", "false");

    // Start refresh (hangs)
    fireEvent.click(refreshBtn);

    // While in-flight: aria-busy should become true
    await waitFor(() => expect(refreshBtn).toHaveAttribute("aria-busy", "true"));

    // Resolve so the component can settle
    resolveRefresh({ sessionId: "s2", pending: false, data: { items: [{ name: "Done" }] }, done: true });
    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());

    // After resolve: aria-busy should be false again
    expect(refreshBtn).toHaveAttribute("aria-busy", "false");
  });

  it("does not re-enter when already refreshing", async () => {
    // Make startForm hang so refresh stays in-flight
    let resolveFirst!: (v: unknown) => void;
    const hangingPromise = new Promise((res) => { resolveFirst = res; });

    startFormMock
      // Initial load
      .mockResolvedValueOnce({ sessionId: "s1", pending: false, data: { items: [{ name: "First" }] }, done: true })
      // Refresh — hangs until we resolve
      .mockReturnValueOnce(hangingPromise);

    render(<FormShell schema={form} />);
    fireEvent.click(screen.getByRole("button", { name: /Submit|Load/i }));
    await screen.findByText("First");

    const refreshBtn = screen.getByRole("button", { name: /Refresh/i });
    fireEvent.click(refreshBtn);

    // While in-flight, clicking again must not trigger a second call
    await waitFor(() => expect(refreshBtn).toBeDisabled());
    fireEvent.click(refreshBtn); // should be no-op (button disabled + guard)

    // Resolve the hanging promise
    resolveFirst({ sessionId: "s2", pending: false, data: { items: [{ name: "Done" }] }, done: true });

    await waitFor(() => expect(screen.getByText("Done")).toBeInTheDocument());
    // Only 2 calls total (initial load + one refresh), not 3
    expect(startFormMock).toHaveBeenCalledTimes(2);
  });
});
