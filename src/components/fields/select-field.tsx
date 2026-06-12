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

export function SelectField({ field, def }: FieldComponentProps) {
  // When optionsFrom is set, pull options from the step data returned by n8n.
  // Static def.options are the fallback for page 0 or when no step data exists.
  const stepData = useContext(StepDataContext);
  const options: FieldOption[] =
    def.optionsFrom && stepData !== null
      ? ((get(stepData as object, def.optionsFrom) as FieldOption[] | undefined) ?? def.options ?? [])
      : (def.options ?? []);

  return (
    <Select
      value={(field.value as string) || ""}
      onValueChange={field.onChange}
    >
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
