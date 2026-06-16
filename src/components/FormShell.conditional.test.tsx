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
