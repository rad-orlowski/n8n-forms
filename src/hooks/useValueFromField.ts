import { useContext, useEffect } from "react";
import { get } from "es-toolkit/compat";
import type { ControllerRenderProps, FieldValues } from "react-hook-form";
import { SelectedItemsContext } from "@/components/SelectedItemsContext";

/**
 * Reactively prefills a field from a sibling select's selected raw item.
 *
 * `spec` is the `valueFromField` string from `FieldDef`: "<sourceName>.<dotPath>".
 * When the named source select changes its selection in `SelectedItemsContext`,
 * this hook resolves `get(rawItem, dotPath)` and calls `field.onChange` with it.
 * No-op when `spec` is undefined.
 */
export function useValueFromField(
  spec: string | undefined,
  field: ControllerRenderProps<FieldValues, string>,
) {
  const { items } = useContext(SelectedItemsContext);
  const dotIndex = spec ? spec.indexOf(".") : -1;
  const sourceName =
    spec && dotIndex >= 0 ? spec.slice(0, dotIndex) : (spec ?? "");
  const dotPath = spec && dotIndex >= 0 ? spec.slice(dotIndex + 1) : "";
  const raw = spec ? items[sourceName] : undefined;
  useEffect(() => {
    if (!spec || raw === undefined) return;
    const v = dotPath ? get(raw as object, dotPath) : raw;
    if (v !== undefined) field.onChange(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, raw, dotPath]);
}
