import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export interface SegmentedOption<T extends string> {
  value: T;
  label?: string;
  icon?: string;
  /** accessible name for an icon-only segment */
  ariaLabel?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: SegmentedOption<T>[];
  "aria-label": string;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Compact single-select toggle — "My tasks" filters, calendar Month/Week/Agenda,
 * task-list scopes. The prototype: `background:#F5F5F8; border-radius:9px;
 * padding:3px`, active segment `background:#fff; box-shadow:0 1px 2px …`.
 */
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
        "inline-flex items-center gap-0.5 rounded-md bg-divider-row p-[3px]",
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
            aria-label={opt.ariaLabel ?? (opt.icon && !opt.label ? opt.value : undefined)}
            title={opt.ariaLabel ?? (opt.icon ? opt.label : undefined)}
            onClick={() => onValueChange(opt.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-chip transition-colors",
              size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[12px]",
              active
                ? "bg-surface font-bold text-foreground shadow-tab"
                : "font-semibold text-muted-2 hover:text-foreground-body",
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
