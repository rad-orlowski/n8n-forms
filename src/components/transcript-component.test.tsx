import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Transcript } from "./Transcript";

describe("Transcript", () => {
  const messages = [
    { ts: "2026-06-18T13:00:00Z", direction: "outbound", channel: "email", status: "approved", body: "<b>Hi</b> Dominic" },
    { ts: "2026-06-18T14:00:00Z", direction: "inbound", channel: "email", status: "", body: "Salary <i>verbal</i>" },
    { ts: "2026-06-18T15:00:00Z", direction: "outbound", channel: "email", status: "superseded", body: "old draft" },
  ];
  it("renders HTML bodies sanitized, drops superseded, sets direction classes", () => {
    render(<Transcript messages={messages} />);
    expect(screen.getByText("Hi").tagName).toBe("B");
    expect(screen.getByText("verbal").tagName).toBe("I");
    expect(screen.queryByText("old draft")).toBeNull();
    expect(document.querySelectorAll(".transcript-row").length).toBe(2);
    expect(document.querySelector(".transcript-dot.in")).toBeTruthy();
    expect(document.querySelector(".transcript-dot.out")).toBeTruthy();
  });
  it("renders nothing when all superseded", () => {
    const { container } = render(<Transcript messages={[{ ts: "1", direction: "outbound", status: "superseded", body: "x" }]} />);
    expect(container.firstChild).toBeNull();
  });
});
