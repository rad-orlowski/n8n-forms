import {
  Mail,
  MessageSquareHeart,
  Radio,
  CalendarCheck,
  Wand2,
  ClipboardList,
  Briefcase,
  Target,
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
};

export function resolveIcon(name: string | undefined): LucideIcon | undefined {
  if (!name) return undefined;
  return ICON_REGISTRY[name];
}
