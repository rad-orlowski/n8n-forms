import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { FieldComponentProps } from "@/lib/schema";

export function DateField({ field, def }: FieldComponentProps) {
  const raw = field.value as string;
  const selected = raw ? new Date(raw) : undefined;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          onBlur={field.onBlur}
          className={cn(
            "w-full justify-start text-left font-normal",
            !raw && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {selected ? format(selected, "PPP") : (def.placeholder ?? "Pick a date")}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) =>
            field.onChange(date ? format(date, "yyyy-MM-dd") : "")
          }
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}
