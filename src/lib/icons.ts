import {
  Mail,
  MessageSquareHeart,
  Radio,
  CalendarCheck,
  Wand2,
  ClipboardList,
  Briefcase,
  Target,
  LayoutList,
  type LucideIcon,
} from "lucide-react";

/** String name -> lucide component. Add an entry to expose an icon to forms. */
const ICON_REGISTRY: Record<string, LucideIcon> = {
  Mail,
  MessageSquareHeart,
  Radio,
  CalendarCheck,
  Wand2,
  ClipboardList,
  Briefcase,
  Target,
  LayoutList,
};

/** Names already warned about, so a misspelling logs once rather than per render. */
const warnedIcons = new Set<string>();

export function resolveIcon(name: string | undefined): LucideIcon | undefined {
  if (!name) return undefined;
  const icon = ICON_REGISTRY[name];
  if (!icon && !warnedIcons.has(name)) {
    warnedIcons.add(name);
    console.warn(
      `[forms] unknown icon "${name}" — no icon will render. Known: ${Object.keys(ICON_REGISTRY).join(", ")}`,
    );
  }
  return icon;
}
