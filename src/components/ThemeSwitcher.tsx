import { Moon, Monitor, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { type Theme, useTheme } from "@/hooks/use-theme";

const OPTIONS: { value: Theme; icon: React.FC<{ className?: string }>; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <TooltipProvider delayDuration={500}>
      <ToggleGroup
        type="single"
        value={theme}
        onValueChange={(v) => v && setTheme(v as Theme)}
        className="fixed top-4 right-4 z-50 flex rounded-md border border-border bg-card/80 backdrop-blur-sm p-0.5 shadow-md gap-0"
        aria-label="Theme switcher"
      >
        {OPTIONS.map(({ value, icon: Icon, label }) => (
          <Tooltip key={value}>
            <TooltipTrigger asChild>
              <ToggleGroupItem
                value={value}
                aria-label={`${label} mode`}
                className="size-7 rounded-sm data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                <Icon className="size-3.5" />
              </ToggleGroupItem>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">
              {label}
            </TooltipContent>
          </Tooltip>
        ))}
      </ToggleGroup>
    </TooltipProvider>
  );
}
