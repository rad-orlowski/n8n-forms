import type { FieldDef } from "@/lib/schema";

/**
 * Static description block — a standalone paragraph of helper text or instructions.
 * Uses `content` as the body. Optionally `label` renders as a bold lead-in.
 *
 * Example:
 *   { type: "description", content: "Fill in the form below and we'll get back to you." }
 *   { type: "description", label: "Note", content: "All fields marked * are required." }
 */
export function DescriptionField({ def }: { def: FieldDef }) {
  return (
    <div className="max-w-prose space-y-1 text-sm text-muted-foreground">
      {def.label && (
        <p className="font-semibold text-foreground">{def.label}</p>
      )}
      {def.content && <p>{def.content}</p>}
    </div>
  );
}
