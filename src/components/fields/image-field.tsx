import type { FieldDef } from "@/lib/schema";

/**
 * Static image — renders an inline image with optional caption.
 * Uses `src` for the image URL (or base64 data URI).
 * Uses `label` as the alt text (for accessibility; defaults to "").
 * Uses `description` as an optional caption shown below.
 *
 * Example:
 *   { type: "image", src: "https://…/diagram.png", label: "Submission flow diagram" }
 *   { type: "image", src: "https://…/logo.svg", label: "Company logo", description: "Acme Corp" }
 */
export function ImageField({ def }: { def: FieldDef }) {
  if (!def.src) return null;

  return (
    <figure className="my-1">
      <img
        src={def.src}
        alt={def.label ?? ""}
        className="max-h-64 w-full rounded-md border border-border/60 object-contain"
      />
      {def.description && (
        <figcaption className="mt-1.5 text-center font-mono text-xs text-muted-foreground">
          {def.description}
        </figcaption>
      )}
    </figure>
  );
}
