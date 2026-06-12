import type { FieldDef } from "@/lib/schema";

/**
 * Static heading — breaks a long form into named sections.
 * Uses `label` as the heading text and `description` as optional subtitle.
 * Set `level: 3` for a minor sub-section heading (default is 2).
 *
 * Example:
 *   { type: "heading", label: "Personal details", level: 2 }
 *   { type: "heading", label: "Optional extras", description: "Fill in what you like", level: 3 }
 */
export function HeadingField({ def }: { def: FieldDef }) {
  const level = def.level ?? 2;

  return (
    <div className="pt-4 first:pt-0">
      {level === 2 ? (
        <h2 className="text-lg font-bold tracking-tight text-foreground">
          {def.label}
        </h2>
      ) : (
        <h3 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">
          {def.label}
        </h3>
      )}
      {def.description && (
        <p className="mt-1 text-sm text-muted-foreground">{def.description}</p>
      )}
      <div className="rule-tech mt-3" />
    </div>
  );
}
