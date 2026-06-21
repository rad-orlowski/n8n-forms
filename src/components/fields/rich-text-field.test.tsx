import { render, screen, waitFor, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useState } from "react";
import type { ControllerRenderProps, FieldValues } from "react-hook-form";
import { RichTextField } from "./rich-text-field";
import {
  SelectedItemsContext,
  type SelectedItemsContextValue,
} from "@/components/SelectedItemsContext";

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

/**
 * Harness that provides a real SelectedItemsContext backed by useState, and
 * exposes a `triggerSelect` button that calls setItem("itemId", rawItem). This
 * exercises the full chain:
 *   SelectedItemsContext.setItem → items["itemId"] changes →
 *   useValueFromField fires field.onChange("<p>…</p>") →
 *   field.value changes →
 *   the mirror useEffect in RichTextField calls editor.commands.setContent →
 *   TipTap renders the HTML.
 */
function ValueFromFieldHarness() {
  const [items, setItems] = useState<Record<string, unknown>>({});
  const ctxValue: SelectedItemsContextValue = {
    items,
    setItem: (name, raw) => setItems((prev) => ({ ...prev, [name]: raw })),
  };

  // RHF-like field managed by useState so onChange flows through field.value
  const [value, setValue] = useState("");
  const field = {
    value,
    onChange: setValue,
    onBlur: () => {},
    name: "draft",
    ref: () => {},
  } as unknown as ControllerRenderProps<FieldValues, string>;

  return (
    <SelectedItemsContext.Provider value={ctxValue}>
      <button
        onClick={() =>
          ctxValue.setItem("itemId", {
            draftText: "<p>Prefilled draft body</p>",
            title: "Acme",
          })
        }
      >
        choose opp
      </button>
      <RichTextField
        field={field}
        def={{
          type: "richtext",
          name: "draft",
          label: "Cover letter",
          valueFromField: "itemId.draftText",
        }}
      />
    </SelectedItemsContext.Provider>
  );
}

/**
 * Harness for the no-clobber regression: a richtext field WITHOUT valueFromField
 * wrapped in a SelectedItemsContext. An unrelated setItem call must NOT change
 * the editor content.
 */
function NoClobberHarness() {
  const [items, setItems] = useState<Record<string, unknown>>({});
  const ctxValue: SelectedItemsContextValue = {
    items,
    setItem: (name, raw) => setItems((prev) => ({ ...prev, [name]: raw })),
  };

  const [value, setValue] = useState("<p>Original content</p>");
  const field = {
    value,
    onChange: setValue,
    onBlur: () => {},
    name: "reply",
    ref: () => {},
  } as unknown as ControllerRenderProps<FieldValues, string>;

  return (
    <SelectedItemsContext.Provider value={ctxValue}>
      <button onClick={() => ctxValue.setItem("unrelated", { foo: "bar" })}>
        change unrelated
      </button>
      <RichTextField
        field={field}
        def={{ type: "richtext", name: "reply", label: "Reply" }}
        // intentionally NO valueFromField
      />
    </SelectedItemsContext.Provider>
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

  it("prefills the editor via SelectedItemsContext → useValueFromField → field.onChange chain", async () => {
    // Start with no selection — editor must be empty
    render(<ValueFromFieldHarness />);
    expect(screen.queryByText("Prefilled draft body")).not.toBeInTheDocument();

    // Simulate a sibling select choosing an item
    await act(async () => {
      screen.getByText("choose opp").click();
    });

    // The full chain must have fired: context item changed →
    // useValueFromField read "itemId.draftText" → called field.onChange →
    // field.value updated → mirror useEffect pushed content to TipTap
    await waitFor(() =>
      expect(screen.getByText("Prefilled draft body")).toBeInTheDocument(),
    );
  });

  it("does NOT clobber a richtext field that has no valueFromField when an unrelated context item changes", async () => {
    render(<NoClobberHarness />);

    // The initial content must be present
    await waitFor(() =>
      expect(screen.getByText("Original content")).toBeInTheDocument(),
    );

    // Change an unrelated context item
    await act(async () => {
      screen.getByText("change unrelated").click();
    });

    // Original content must still be there — no spurious onChange fired
    await waitFor(() =>
      expect(screen.getByText("Original content")).toBeInTheDocument(),
    );
  });
});
