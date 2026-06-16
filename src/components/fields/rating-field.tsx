import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FieldComponentProps } from "@/lib/schema";

/**
 * Example custom form element — a star rating.
 *
 * This is the worked reference for adding your own controls:
 *   1. Build a component with the { field, def } contract.
 *   2. Register its `type` string in src/components/fields/index.ts.
 *   3. Use { type: "rating", name, ... } in any *.form.json5 file.
 */
export function RatingField({ field, def }: FieldComponentProps) {
  const max = def.max ?? 5;
  const value = Number(field.value) || 0;

  return (
    <div
      role="group"
      aria-label={def.label ?? "Rating"}
      className="flex items-center gap-1"
      onBlur={field.onBlur}
    >
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} of ${max}`}
          onClick={() => field.onChange(n === value ? 0 : n)}
          className="rounded-sm p-0.5 outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Star
            className={cn(
              "h-7 w-7 transition-colors",
              n <= value
                ? "fill-primary text-primary"
                : "text-muted-foreground/40 hover:text-muted-foreground",
            )}
          />
        </button>
      ))}
    </div>
  );
}
