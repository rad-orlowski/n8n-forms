import { Checkbox } from "@/components/ui/checkbox";
import type { FieldComponentProps } from "@/lib/schema";

export function CheckboxField({ field }: FieldComponentProps) {
  return (
    <Checkbox
      checked={Boolean(field.value)}
      onCheckedChange={(checked) => field.onChange(checked === true)}
      onBlur={field.onBlur}
    />
  );
}
