import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useState } from "react";
import type { ControllerRenderProps, FieldValues } from "react-hook-form";
import { RichTextField } from "./rich-text-field";

/** Harness: drives field.value externally (simulating valueFromField) after mount. */
function Harness() {
  const [value, setValue] = useState("");
  const field = {
    value,
    onChange: setValue,
    onBlur: () => {},
    name: "msg",
    ref: () => {},
  } as unknown as ControllerRenderProps<FieldValues, string>;
  return (
    <>
      <button onClick={() => setValue("<p>Injected draft</p>")}>inject</button>
      <RichTextField
        field={field}
        def={{ type: "richtext", name: "msg", label: "Message" }}
      />
    </>
  );
}

describe("RichTextField reactive prefill", () => {
  it("renders an externally-set value into the editor after mount", async () => {
    render(<Harness />);
    screen.getByText("inject").click();
    await waitFor(() =>
      expect(screen.getByText("Injected draft")).toBeInTheDocument(),
    );
  });
});
