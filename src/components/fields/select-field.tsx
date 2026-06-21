import { useContext } from "react";
import { get } from "es-toolkit/compat";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldComponentProps, FieldOption } from "@/lib/schema";
import { StepDataContext } from "@/components/StepDataContext";
import { SelectedItemsContext } from "@/components/SelectedItemsContext";
import { useValueFromField } from "@/hooks/useValueFromField";
import { isSpuriousEmptyChange } from "./select-field.helpers";

export function SelectField({ field, def }: FieldComponentProps) {
  // When optionsFrom is set, pull options from the step data returned by n8n.
  // Static def.options are the fallback for page 0 or when no step data exists.
  const stepData = useContext(StepDataContext);
  const { setItem } = useContext(SelectedItemsContext);

  // Reactive prefill from a sibling select's selected raw item (valueFromField).
  useValueFromField(def.valueFromField, field);

  // Options resolution:
  // When optionLabel + optionValue are set, map raw n8n objects to {label, value}
  // and maintain a reverse map so we can publish the full raw item on change.
  // Otherwise fall back to the existing behaviour (optionsFrom expects [{label,value}]).
  let options: FieldOption[];
  let rawByValue: Map<string, unknown> | null = null;

  if (
    def.optionsFrom &&
    def.optionLabel &&
    def.optionValue &&
    stepData !== null
  ) {
    const rawArray =
      (get(stepData as object, def.optionsFrom) as unknown[] | undefined) ?? [];
    rawByValue = new Map<string, unknown>();
    options = rawArray.flatMap((raw) => {
      const value = String(get(raw as object, def.optionValue!));
      if (value === "undefined" || value === "null") return [];
      const label = def
        .optionLabel!.map((k) => String(get(raw as object, k) ?? ""))
        .filter(Boolean)
        .join(" @ ");
      rawByValue!.set(value, raw);
      return [{ label, value }];
    });
  } else if (def.optionsFrom && stepData !== null) {
    // Existing behaviour: optionsFrom expected to already be [{label, value}]
    options =
      (get(stepData as object, def.optionsFrom) as FieldOption[] | undefined) ??
      def.options ??
      [];
  } else {
    options = def.options ?? [];
  }

  function handleChange(value: string) {
    // Ignore Radix's spurious mount-time empty-clear (see isSpuriousEmptyChange),
    // which would otherwise clobber a preselected value. A genuine clear still
    // propagates.
    if (isSpuriousEmptyChange(value, field.value, options)) return;
    field.onChange(value);
    // Publish the full raw item to SelectedItemsContext so sibling fields
    // can reactively prefill via valueFromField.
    if (rawByValue) {
      setItem(field.name, rawByValue.get(value));
    }
  }

  return (
    <Select value={(field.value as string) || ""} onValueChange={handleChange}>
      <SelectTrigger onBlur={field.onBlur}>
        <SelectValue placeholder={def.placeholder ?? "Select…"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
