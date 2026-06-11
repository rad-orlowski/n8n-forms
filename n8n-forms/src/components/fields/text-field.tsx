import { Input } from "@/components/ui/input";
import type { FieldComponentProps } from "@/lib/schema";

export function TextField({ field, def }: FieldComponentProps) {
  return (
    <Input
      {...field}
      value={(field.value as string) ?? ""}
      placeholder={def.placeholder}
    />
  );
}
