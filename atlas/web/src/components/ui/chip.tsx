import { cn } from "@/lib/cn";
import { Icon } from "./icon";

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  /** dark-selected (project chips, building tabs) vs pale-blue-selected (lighter contexts) */
  activeVariant?: "dark" | "pale";
  icon?: string;
  count?: number | string;
}

/** The design's ubiquitous filter/selector chip: bordered white, active = dark or pale-blue fill. */
export function Chip({
  active,
  activeVariant = "dark",
  icon,
  count,
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-btn border px-2.5 py-1 text-[11px] transition-colors",
        active
          ? activeVariant === "dark"
            ? "border-transparent bg-foreground font-semibold text-white"
            : "border-primary-border bg-primary-surface-pale font-semibold text-primary"
          : "border-border bg-surface text-body hover:bg-canvas",
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
      {count != null && (
        <span
          className={cn(
            "rounded-badge px-1 text-[9.5px] font-mono",
            active ? "bg-white/20" : "bg-surface-track text-muted",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
