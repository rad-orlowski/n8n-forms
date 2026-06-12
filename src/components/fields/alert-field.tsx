import { Info, TriangleAlert, OctagonAlert, CheckCircle2 } from "lucide-react";
import type { FieldDef } from "@/lib/schema";

/**
 * Static alert / callout box — highlights important notes before submission.
 * Uses `content` as the body text and `label` as an optional bold title.
 * Set `variant` to one of: "info" (default) | "warning" | "danger" | "success".
 *
 * Examples:
 *   { type: "alert", variant: "warning", content: "This action cannot be undone." }
 *   { type: "alert", variant: "info", label: "Tip", content: "Use your work email address." }
 */
export function AlertField({ def }: { def: FieldDef }) {
  const variant = def.variant ?? "info";

  const styles = {
    info: {
      wrapper: "border-border/60 bg-muted/30",
      icon: "text-muted-foreground",
      title: "text-foreground",
      body: "text-muted-foreground",
      Icon: Info,
    },
    warning: {
      wrapper: "border-primary/40 bg-primary/10",
      icon: "text-primary",
      title: "text-primary",
      body: "text-primary/80",
      Icon: TriangleAlert,
    },
    danger: {
      wrapper: "border-destructive/40 bg-destructive/10",
      icon: "text-destructive",
      title: "text-destructive",
      body: "text-destructive/80",
      Icon: OctagonAlert,
    },
    success: {
      wrapper: "border-success/40 bg-success/5",
      icon: "text-success",
      title: "text-success",
      body: "text-success/80",
      Icon: CheckCircle2,
    },
  } as const;

  const s = styles[variant as keyof typeof styles] ?? styles.info;
  const { Icon } = s;

  return (
    <div
      className={`flex items-start gap-3 rounded-md border p-3 text-sm ${s.wrapper}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.icon}`} />
      <div>
        {def.label && (
          <p className={`font-semibold ${s.title}`}>{def.label}</p>
        )}
        {def.content && (
          <p className={def.label ? `mt-0.5 ${s.body}` : s.body}>
            {def.content}
          </p>
        )}
      </div>
    </div>
  );
}
