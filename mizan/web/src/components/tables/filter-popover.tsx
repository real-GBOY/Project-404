import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Icon } from "@/components/ui/icon";

export interface FilterGroup {
  key: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * Toolbar "Filter" button + popover. Each group is a single-select rendered as a
 * row of chips; selecting a chip toggles it. Values live in the caller (usually
 * URL params) so filtering itself stays where the list is. `count` on the button
 * shows how many groups are active.
 */
export function FilterPopover({
  groups,
  value,
  onChange,
}: {
  groups: FilterGroup[];
  value: Record<string, string | undefined>;
  onChange: (key: string, value: string | undefined) => void;
}) {
  const { t } = useTranslation();
  const active = groups.filter((g) => value[g.key]).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-[7px] rounded-btn border border-border-control px-[13px] text-[12.5px] font-bold text-foreground transition-colors hover:bg-surface-subtle data-[state=open]:bg-surface-subtle"
        >
          <Icon name="filter_list" size={17} className="text-muted" />
          {t("common:actions.filter", { defaultValue: "Filter" })}
          {active > 0 && (
            <span className="rounded-pill bg-surface-sand px-[7px] py-px text-[11px] text-link">
              {active}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <div className="flex flex-col gap-3.5">
          {groups.map((g) => (
            <div key={g.key}>
              <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
                {g.label}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {g.options.map((o) => {
                  const on = value[g.key] === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => onChange(g.key, on ? undefined : o.value)}
                      className={
                        on
                          ? "rounded-pill bg-primary px-2.5 py-1 text-[11.5px] font-bold text-primary-foreground"
                          : "rounded-pill border border-border-control px-2.5 py-1 text-[11.5px] font-semibold text-secondary hover:bg-surface-subtle"
                      }
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {active > 0 && (
            <button
              type="button"
              onClick={() => groups.forEach((g) => onChange(g.key, undefined))}
              className="self-start text-[11.5px] font-bold text-link hover:underline"
            >
              {t("common:actions.clear", { defaultValue: "Clear" })}
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
