import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { SearchInput } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";

export function ListToolbar({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 border-b border-border px-2.5 py-2", className)}>
      {children}
    </div>
  );
}

export function FilterButton({ label, onClick }: { label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-btn border border-border bg-surface px-2.5 py-1 text-[11px] text-body transition-colors hover:bg-canvas"
    >
      {label} <span className="text-[9px] text-subtle">▾</span>
    </button>
  );
}

export function ViewToggle({ value, onChange }: { value: "table" | "grid"; onChange: (v: "table" | "grid") => void }) {
  return (
    <div className="flex overflow-hidden rounded-btn border border-border">
      {(["table", "grid"] as const).map((v, i) => (
        <button
          key={v}
          type="button"
          aria-label={v}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "flex h-7 w-7 items-center justify-center transition-colors",
            i === 1 && "border-l border-border",
            value === v ? "bg-canvas text-foreground" : "text-subtle hover:bg-canvas",
          )}
        >
          <Icon name={v === "table" ? "rows" : "grid"} size={13} />
        </button>
      ))}
    </div>
  );
}

export { SearchInput };
