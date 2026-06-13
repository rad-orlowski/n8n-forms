import { createContext } from "react";

/** The full raw object currently selected in each select field on the active page, keyed by field name. */
export type SelectedItems = Record<string, unknown>;

export interface SelectedItemsContextValue {
  items: SelectedItems;
  setItem: (name: string, raw: unknown) => void;
}

/**
 * Carries each select field's currently-selected RAW option object to sibling
 * field components, so `valueFromField` can reactively prefill from another
 * select's selection. Reset when the wizard page changes.
 */
export const SelectedItemsContext = createContext<SelectedItemsContextValue>({
  items: {},
  setItem: () => {},
});
