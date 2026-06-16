// Component test — run via `vitest` (jsdom env), not `bun test` (no DOM).
import { describe, it, expect } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { FormShell } from "./FormShell";
import type { FormSchema } from "@/lib/schema";

const schema = {
  slug: "cond",
  title: "Cond",
  pages: [
    {
      fields: [
        { type: "text", name: "country", label: "Country" },
        {
          type: "text",
          name: "state",
          label: "State",
          visibleIf: "country == 'US'",
        },
      ],
    },
  ],
} as unknown as FormSchema;

// Schema for requiredIf integration test.
// `trigger` controls whether `notes` becomes required.
const requiredIfSchema = {
  slug: "req-if",
  title: "RequiredIf",
  pages: [
    {
      fields: [
        { type: "text", name: "trigger", label: "Trigger" },
        {
          type: "text",
          name: "notes",
          label: "Notes",
          requiredIf: "trigger == 'yes'",
        },
      ],
    },
  ],
} as unknown as FormSchema;

describe("FormShell requiredIf validation", () => {
  it("blocks submission with a validation error when requiredIf field is empty and condition is met", async () => {
    const { container } = render(<FormShell schema={requiredIfSchema} />);

    // Set trigger to 'yes' — this makes 'notes' required via requiredIf
    const triggerInput =
      container.querySelector<HTMLInputElement>('[name="trigger"]')!;
    expect(triggerInput).toBeInTheDocument();
    fireEvent.change(triggerInput, { target: { value: "yes" } });
    fireEvent.blur(triggerInput);

    // Leave 'notes' empty and submit — should be blocked by validation
    const submitBtn = container.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    )!;
    expect(submitBtn).toBeInTheDocument();
    fireEvent.click(submitBtn);

    // A required-field validation error should appear for 'notes'
    await waitFor(() => {
      expect(container.textContent).toContain("This field is required");
    });

    // The form should not have advanced (submit button still present)
    expect(
      container.querySelector<HTMLButtonElement>('button[type="submit"]'),
    ).toBeInTheDocument();
  });
});

describe("FormShell conditional visibility", () => {
  it("hides a visibleIf field until its condition is met", async () => {
    const { container } = render(<FormShell schema={schema} />);

    // State field should not be in the DOM yet (condition not met)
    expect(
      container.querySelector<HTMLInputElement>('[name="state"]'),
    ).not.toBeInTheDocument();

    // Change country to "US" to satisfy the visibleIf condition
    const country =
      container.querySelector<HTMLInputElement>('[name="country"]')!;
    expect(country).toBeInTheDocument();
    fireEvent.change(country, { target: { value: "US" } });

    await waitFor(() =>
      expect(
        container.querySelector<HTMLInputElement>('[name="state"]'),
      ).toBeInTheDocument(),
    );
  });
});
