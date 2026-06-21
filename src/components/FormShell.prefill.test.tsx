// Component test — run via `vitest` (jsdom env), not `bun test` (no DOM).
// Covers prefillFromQuery: a URL query param seeds a dynamic select's value
// once the matching option is loaded, with a stale-value guard + notice.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { FormShell } from "./FormShell";
import type { FormSchema } from "@/lib/schema";

const { startFormMock, stepFormMock, openEventStreamMock } = vi.hoisted(() => ({
  startFormMock: vi.fn(),
  stepFormMock: vi.fn(),
  openEventStreamMock: vi.fn(),
}));
vi.mock("@/lib/submit", () => ({
  startForm: startFormMock,
  stepForm: stepFormMock,
  openEventStream: openEventStreamMock,
}));

beforeEach(() => {
  startFormMock.mockReset();
  stepFormMock.mockReset();
  openEventStreamMock.mockReset();
});

// Mimics the `act` form: page 0 is an input-less load step, page 1 has a
// dynamic select bound to the loaded opps + prefillFromQuery: "opp".
const schema = {
  slug: "act",
  title: "Act",
  pages: [
    {
      method: "GET",
      fields: [{ type: "description", content: "load" }],
    },
    {
      fields: [
        {
          type: "select",
          name: "itemId",
          label: "Opportunity",
          required: true,
          optionsFrom: "opps",
          optionLabel: ["title"],
          optionValue: "itemId",
          prefillFromQuery: "opp",
        },
      ],
    },
  ],
} as unknown as FormSchema;

const OPPS = [
  { itemId: "o1", title: "Job One" },
  { itemId: "o2", title: "Job Two" },
];

/** Submit page 0 → resolves with the opps list → advances to page 1. */
async function advanceToPage1(container: HTMLElement) {
  startFormMock.mockResolvedValue({
    sessionId: "s1",
    done: false,
    data: { opps: OPPS },
  });
  fireEvent.click(
    container.querySelector<HTMLButtonElement>('button[type="submit"]')!,
  );
  await waitFor(() => expect(startFormMock).toHaveBeenCalled());
}

describe("FormShell prefillFromQuery", () => {
  it("preselects the dynamic select when the query value matches a loaded option", async () => {
    stepFormMock.mockResolvedValue({ done: true, data: null });
    const { container } = render(
      <FormShell schema={schema} queryParams={{ opp: "o1" }} />,
    );

    await advanceToPage1(container);

    // The opp is preselected, so submitting page 1 hands itemId:"o1" to n8n
    // without the user touching the select.
    await waitFor(() =>
      expect(
        container.querySelector<HTMLButtonElement>('button[type="submit"]'),
      ).toBeInTheDocument(),
    );
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!,
    );
    await waitFor(() => expect(stepFormMock).toHaveBeenCalled());

    const submitted = stepFormMock.mock.calls[0][1] as Record<string, unknown>;
    expect(submitted).toMatchObject({ itemId: "o1" });
  });

  it("does not preselect a stale opp not in the loaded list, and shows a notice", async () => {
    const { container } = render(
      <FormShell schema={schema} queryParams={{ opp: "gone" }} />,
    );

    await advanceToPage1(container);

    // Notice explains why nothing is selected.
    await waitFor(() =>
      expect(container.textContent).toMatch(/no longer available/i),
    );

    // Required + empty → submit is blocked, so n8n is never called with a stale id.
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!,
    );
    await waitFor(() =>
      expect(container.textContent).toContain("This field is required"),
    );
    expect(stepFormMock).not.toHaveBeenCalled();
  });

  it("does not show the notice on page 0 (no step data yet)", () => {
    const { container } = render(
      <FormShell schema={schema} queryParams={{ opp: "gone" }} />,
    );
    expect(container.textContent).not.toMatch(/no longer available/i);
  });
});

// Regression: a select preselected via valueFrom (dot-path into step data) must
// survive Radix's spurious mount-time empty-clear, just like prefillFromQuery.
// This path was silently broken before the empty-clear guard and had no test.
describe("FormShell valueFrom preselect on a select", () => {
  const valueFromSchema = {
    slug: "vf",
    title: "VF",
    pages: [
      { method: "GET", fields: [{ type: "description", content: "load" }] },
      {
        fields: [
          {
            type: "select",
            name: "itemId",
            label: "Opportunity",
            required: true,
            optionsFrom: "opps",
            optionLabel: ["title"],
            optionValue: "itemId",
            valueFrom: "chosen",
          },
        ],
      },
    ],
  } as unknown as FormSchema;

  it("preselects and submits the value resolved from step data", async () => {
    stepFormMock.mockResolvedValue({ done: true, data: null });
    startFormMock.mockResolvedValue({
      sessionId: "s1",
      done: false,
      data: { opps: OPPS, chosen: "o2" },
    });
    const { container } = render(<FormShell schema={valueFromSchema} />);

    fireEvent.click(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!,
    );
    await waitFor(() => expect(startFormMock).toHaveBeenCalled());

    await waitFor(() =>
      expect(
        container.querySelector<HTMLButtonElement>('button[type="submit"]'),
      ).toBeInTheDocument(),
    );
    fireEvent.click(
      container.querySelector<HTMLButtonElement>('button[type="submit"]')!,
    );
    await waitFor(() => expect(stepFormMock).toHaveBeenCalled());

    const submitted = stepFormMock.mock.calls[0][1] as Record<string, unknown>;
    expect(submitted).toMatchObject({ itemId: "o2" });
  });
});
