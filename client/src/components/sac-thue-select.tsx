import { SAC_THUE_OPTIONS } from "@shared/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SacThueSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  className?: string;
}

export function SacThueSelect({ value, onChange, className }: SacThueSelectProps) {
  const toggle = (v: string) => {
    if (value.includes(v)) {
      onChange(value.filter(x => x !== v));
    } else {
      onChange([...value, v]);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {SAC_THUE_OPTIONS.map((opt) => (
        <Badge
          key={opt.value}
          variant={value.includes(opt.value) ? "default" : "outline"}
          className={cn(
            "cursor-pointer text-xs transition-colors",
            value.includes(opt.value)
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "hover:bg-accent"
          )}
          onClick={() => toggle(opt.value)}
          data-testid={`sac-thue-${opt.value}`}
        >
          {opt.value}
        </Badge>
      ))}
    </div>
  );
}
