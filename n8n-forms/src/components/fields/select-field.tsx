import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FieldComponentProps } from "@/lib/schema";

export function SelectField({ field, def }: FieldComponentProps) {
  return (
    <Select
      value={(field.value as string) || ""}
      onValueChange={field.onChange}
    >
      <SelectTrigger onBlur={field.onBlur}>
        <SelectValue placeholder={def.placeholder ?? "Select…"} />
      </SelectTrigger>
      <SelectContent>
        {def.options?.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
