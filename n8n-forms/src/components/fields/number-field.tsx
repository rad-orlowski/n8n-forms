import { Input } from "@/components/ui/input";
import type { FieldComponentProps } from "@/lib/schema";

export function NumberField({ field, def }: FieldComponentProps) {
  return (
    <Input
      {...field}
      type="number"
      inputMode="decimal"
      min={def.min}
      max={def.max}
      value={(field.value as string | number) ?? ""}
      placeholder={def.placeholder}
    />
  );
}
