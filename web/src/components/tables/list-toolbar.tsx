import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";

interface ListToolbarProps {
  search?: { value: string; onChange: (v: string) => void; placeholder?: string };
  /** filter controls (Select components) */
  filters?: ReactNode;
  view?: { value: "table" | "grid"; onChange: (v: "table" | "grid") => void };
  /** trailing actions */
  actions?: ReactNode;
  className?: string;
}

export function ListToolbar({ search, filters, view, actions, className }: ListToolbarProps) {
  const { t } = useTranslation("common");
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {search && (
        <SearchInput
          className="w-full max-w-xs"
          value={search.value}
          placeholder={search.placeholder}
          onChange={(e) => search.onChange(e.target.value)}
          onClear={() => search.onChange("")}
        />
      )}
      {filters}
      <div className="ms-auto flex items-center gap-2">
        {actions}
        {view && (
          <SegmentedControl
            aria-label={t("actions.view")}
            size="sm"
            value={view.value}
            onValueChange={view.onChange}
            options={[
              { value: "table", icon: "view_list", ariaLabel: t("table.view_table") },
              { value: "grid", icon: "grid_view", ariaLabel: t("table.view_grid") },
            ]}
          />
        )}
      </div>
    </div>
  );
}
