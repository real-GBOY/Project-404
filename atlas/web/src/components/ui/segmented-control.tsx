import { cn } from "@/lib/cn";

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  className?: string;
}

/** The design's date-range / mode toggle: bordered pill, active segment dark-filled. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div className={cn("flex overflow-hidden rounded-btn border border-border bg-surface", className)}>
      {options.map((opt, i) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            "px-2.5 py-1.5 text-[11px] transition-colors",
            i > 0 && "border-l border-border",
            value === opt.value ? "bg-foreground font-semibold text-white" : "text-body hover:bg-canvas",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
