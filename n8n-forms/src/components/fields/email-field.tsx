import { Input } from "@/components/ui/input";
import type { FieldComponentProps } from "@/lib/schema";

export function EmailField({ field, def }: FieldComponentProps) {
  return (
    <Input
      {...field}
      type="email"
      inputMode="email"
      autoComplete="email"
      value={(field.value as string) ?? ""}
      placeholder={def.placeholder ?? "you@example.com"}
    />
  );
}
