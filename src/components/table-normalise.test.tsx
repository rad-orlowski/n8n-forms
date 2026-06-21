import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ResponsePanelForTest as ResponsePanel } from "./FormShell";

const tableResponseConfig = {
  fields: [
    {
      key: "opps",
      format: "table" as const,
      columns: [
        { key: "title", label: "Role / Company" },
        { key: "totalScore", label: "Total score" },
      ],
    },
  ],
};

describe("format:table normalisation", () => {
  it("renders nothing-broken for an array of row objects (no [object Object])", () => {
    const data = { opps: [{ title: "Lead SDE", totalScore: 5.63 }] };
    render(<ResponsePanel responseConfig={tableResponseConfig} data={data} />);
    expect(screen.queryByText("[object Object]")).toBeNull();
  });

  it("renders em-dash placeholder for empty opps array", () => {
    const data = { opps: [] };
    render(<ResponsePanel responseConfig={tableResponseConfig} data={data} />);
    expect(screen.queryByText("[object Object]")).toBeNull();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders em-dash placeholder for null opps", () => {
    const data = { opps: null };
    render(<ResponsePanel responseConfig={tableResponseConfig} data={data} />);
    expect(screen.queryByText("[object Object]")).toBeNull();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("renders row cell data once the 02-T TableRenderer lands (e.g. 'Lead SDE')", () => {
    const data = { opps: [{ title: "Lead SDE", totalScore: 5.63 }] };
    render(<ResponsePanel responseConfig={tableResponseConfig} data={data} />);
    expect(screen.getByText("Lead SDE")).toBeInTheDocument();
    expect(screen.queryByText("[object Object]")).toBeNull();
  });
});
