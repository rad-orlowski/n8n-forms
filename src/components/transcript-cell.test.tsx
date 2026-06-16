import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ResponsePanelForTest as ResponsePanel } from "./FormShell";

describe("format:transcript", () => {
  it("renders a timeline row per message with direction classes", () => {
    const data = {
      messages: [
        {
          ts: "2026-06-16T14:02:00Z",
          direction: "outbound",
          channel: "email",
          status: "approved",
          body: "Hi Jane",
        },
        {
          ts: "2026-06-16T16:41:00Z",
          direction: "inbound",
          channel: "email",
          status: "",
          body: "Salary is 95k",
        },
      ],
    };
    render(
      <ResponsePanel
        responseConfig={{ fields: [{ key: "messages", format: "transcript" }] }}
        data={data}
      />,
    );
    expect(screen.getByText("Hi Jane")).toBeInTheDocument();
    expect(screen.getByText("Salary is 95k")).toBeInTheDocument();
    expect(document.querySelectorAll(".transcript-row").length).toBe(2);
    expect(document.querySelector(".transcript-dot.out")).toBeTruthy();
    expect(document.querySelector(".transcript-dot.in")).toBeTruthy();
  });
});

describe("format:copy", () => {
  it("renders a copy box with the text content", () => {
    const data = { summary: "This is a long text for copying." };
    render(
      <ResponsePanel
        responseConfig={{ fields: [{ key: "summary", format: "copy" }] }}
        data={data}
      />,
    );
    expect(
      screen.getByText("This is a long text for copying."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });
});
