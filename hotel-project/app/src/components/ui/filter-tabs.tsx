import { cn } from "@/lib/cn";

export interface FilterTab<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/** The design's filter pills: solid primary when active, neutral-soft otherwise. */
export function FilterTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  size = "md",
}: {
  tabs: Array<FilterTab<T>>;
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "md" | "sm";
}) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-2">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn(
              "cursor-pointer font-semibold transition-colors",
              size === "md"
                ? "rounded-control px-3.5 py-2 text-small"
                : "rounded-[7px] px-[13px] py-[7px] text-label font-bold",
              active ? "bg-primary text-white" : "bg-neutral-soft text-ink-nav hover:bg-border",
            )}
          >
            {t.label}
            {t.count !== undefined ? <span className="ml-1.5 opacity-75">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
