import { Textarea } from "@/components/ui/textarea";
import type { FieldComponentProps } from "@/lib/schema";

export function TextareaField({ field, def }: FieldComponentProps) {
  return (
    <Textarea
      {...field}
      rows={5}
      value={(field.value as string) ?? ""}
      placeholder={def.placeholder}
    />
  );
}
