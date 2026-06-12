import { Input } from "@/components/ui/input";
import type { FieldComponentProps } from "@/lib/schema";

export function UrlField({ field, def }: FieldComponentProps) {
  return (
    <Input
      {...field}
      type="url"
      inputMode="url"
      autoComplete="url"
      value={(field.value as string) ?? ""}
      placeholder={def.placeholder ?? "https://example.com"}
    />
  );
}
