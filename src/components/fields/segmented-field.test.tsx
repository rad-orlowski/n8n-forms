import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import type { ControllerRenderProps, FieldValues } from "react-hook-form";
import { SegmentedField } from "./segmented-field";

function makeField(value: string, onChange = vi.fn(), onBlur = vi.fn()) {
  return {
    value,
    onChange,
    onBlur,
    name: "kind",
    ref: () => {},
  } as unknown as ControllerRenderProps<FieldValues, string>;
}

const options = [
  { label: "Inbound", value: "inbound" },
  { label: "Outbound", value: "outbound" },
];

const def = { type: "segmented", name: "kind", label: "Kind", options };

describe("SegmentedField", () => {
  it("renders all option labels as radio buttons", () => {
    render(<SegmentedField field={makeField("")} def={def} />);
    expect(screen.getByRole("radio", { name: "Inbound" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Outbound" })).toBeInTheDocument();
  });

  it("calls onChange with the option value when clicked", () => {
    const onChange = vi.fn();
    render(<SegmentedField field={makeField("", onChange)} def={def} />);
    fireEvent.click(screen.getByRole("radio", { name: "Inbound" }));
    expect(onChange).toHaveBeenCalledWith("inbound");
  });

  it("marks the currently selected option as aria-checked", () => {
    render(<SegmentedField field={makeField("outbound")} def={def} />);
    expect(screen.getByRole("radio", { name: "Outbound" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Inbound" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("calls onBlur when an option is clicked", () => {
    const onBlur = vi.fn();
    render(<SegmentedField field={makeField("", vi.fn(), onBlur)} def={def} />);
    fireEvent.click(screen.getByRole("radio", { name: "Inbound" }));
    expect(onBlur).toHaveBeenCalled();
  });

  it("renders the radiogroup container even when options are empty", () => {
    const { container } = render(
      <SegmentedField field={makeField("")} def={{ ...def, options: [] }} />,
    );
    expect(container.querySelector('[role="radiogroup"]')).toBeInTheDocument();
  });
});
