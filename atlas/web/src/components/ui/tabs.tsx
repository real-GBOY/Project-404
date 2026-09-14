import { cn } from "@/lib/cn";

export interface TabBarProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  tabs: readonly T[];
  className?: string;
}

/** The design's screen-level tab bar (Customer 360, Project Detail): underlined, bold active tab. */
export function TabBar<T extends string>({ value, onChange, tabs, className }: TabBarProps<T>) {
  return (
    <div className={cn("flex gap-4 border-b border-border", className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t}
          type="button"
          role="tab"
          aria-selected={value === t}
          onClick={() => onChange(t)}
          className={cn(
            "border-b-2 px-0.5 pb-2 text-[12px] transition-colors",
            value === t ? "border-primary font-semibold text-foreground" : "border-transparent text-secondary hover:text-foreground",
          )}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
