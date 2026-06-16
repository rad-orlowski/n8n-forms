import { cn } from "@/lib/utils";
import type { FieldComponentProps } from "@/lib/schema";

/**
 * Segmented control — a horizontal row of connected toggle buttons for
 * mutually-exclusive single-select. Good for 2–4 short options.
 *
 * Semantics: role="radiogroup" containing role="radio" buttons, matching the
 * native <input type="radio"> mental model for screen readers and keyboard nav.
 * Arrow keys cycle focus within the group (Left/Right); Enter/Space select.
 */
export function SegmentedField({ field, def }: FieldComponentProps) {
  const options = def.options ?? [];

  function handleSelect(value: string) {
    field.onChange(value);
    field.onBlur();
  }

  function handleKeyDown(
    e: React.KeyboardEvent<HTMLButtonElement>,
    idx: number,
  ) {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = (idx + 1) % options.length;
      (e.currentTarget.parentElement?.children[next] as HTMLElement)?.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const prev = (idx - 1 + options.length) % options.length;
      (e.currentTarget.parentElement?.children[prev] as HTMLElement)?.focus();
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={def.label}
      className="inline-flex rounded-md border border-border overflow-hidden"
    >
      {options.map((opt, idx) => {
        const selected = field.value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={
              selected ||
              (!options.some((o) => o.value === field.value) && idx === 0)
                ? 0
                : -1
            }
            onClick={() => handleSelect(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={cn(
              "px-4 py-2 text-sm font-medium transition-colors outline-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              // Divider between segments (not on the first one)
              idx > 0 && "border-l border-border",
              selected
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground hover:bg-muted",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
