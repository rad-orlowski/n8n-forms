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

  it("drops superseded messages and keeps the rest", () => {
    const data = {
      messages: [
        {
          ts: "1",
          direction: "outbound",
          status: "superseded",
          body: "old draft",
        },
        {
          ts: "2",
          direction: "outbound",
          status: "approved",
          body: "final draft",
        },
      ],
    };
    render(
      <ResponsePanel
        responseConfig={{ fields: [{ key: "messages", format: "transcript" }] }}
        data={data}
      />,
    );
    expect(screen.queryByText("old draft")).not.toBeInTheDocument();
    expect(screen.getByText("final draft")).toBeInTheDocument();
    expect(document.querySelectorAll(".transcript-row").length).toBe(1);
  });

  it("renders '—' when every message is superseded (no empty timeline)", () => {
    const data = {
      messages: [
        { ts: "1", direction: "outbound", status: "superseded", body: "old" },
      ],
    };
    render(
      <ResponsePanel
        responseConfig={{ fields: [{ key: "messages", format: "transcript" }] }}
        data={data}
      />,
    );
    expect(document.querySelector("ol.transcript")).toBeNull();
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders message body HTML (sanitized), not literal tags", () => {
    render(
      <ResponsePanel
        responseConfig={{ fields: [{ key: "messages", format: "transcript" }] }}
        data={{
          messages: [
            {
              ts: "1",
              direction: "inbound",
              channel: "email",
              status: "",
              body: "<b>Bold</b>",
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("Bold").tagName).toBe("B");
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

  it("joins an array value with newlines instead of comma-coercing", () => {
    const data = { lines: ["first", "second"] };
    const { container } = render(
      <ResponsePanel
        responseConfig={{ fields: [{ key: "lines", format: "copy" }] }}
        data={data}
      />,
    );
    // newline-joined, not the lossy "first,second" of String(array)
    expect(container.querySelector(".whitespace-pre-wrap")?.textContent).toBe(
      "first\nsecond",
    );
  });
});
