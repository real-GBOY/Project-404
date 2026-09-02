import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export interface SegmentedOption<T extends string> {
  value: T;
  label?: string;
  /** icon-only segment — provide `aria-label` via `label` */
  icon?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  "aria-label": string;
  size?: "sm" | "md";
  className?: string;
}

/** A compact single-select toggle — table/grid, Month/Week/Agenda, etc. */
export function SegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  size = "md",
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      data-slot="segmented-control"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-border-control bg-surface-subtle p-0.5",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.icon && !opt.label ? opt.value : undefined}
            title={opt.icon ? opt.label : undefined}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-[7px] font-semibold transition-colors",
              size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-2.5 text-[12.5px]",
              active
                ? "bg-surface text-foreground shadow-pop"
                : "text-muted hover:text-foreground-body",
            )}
          >
            {opt.icon && <Icon name={opt.icon} size={16} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
