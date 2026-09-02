import { NavLink } from "react-router-dom";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/icon";

export interface TabGroupItem {
  to: string;
  label: string;
  icon: string;
  count?: string | number;
}

/**
 * The sand tab group that fronts the "Case Work" (Matters / Hearings / Tasks) and
 * "Finance" (Invoices / Payments / Expenses) super-screens.
 * `background:#EDE3DB; border-radius:11px; padding:4px`; active pill
 * `background:#fff; font-weight:800; box-shadow:0 1px 2px rgba(36,20,14,0.10)`.
 */
export function TabGroup({ items, hint }: { items: TabGroupItem[]; hint?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.5">
      <div className="flex gap-[3px] rounded-group bg-surface-sand-hover p-1">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end
            className={({ isActive }) =>
              cn(
                "flex items-center gap-[7px] rounded-lg px-[15px] py-2 text-[13px] transition-colors",
                isActive
                  ? "bg-surface font-extrabold text-primary shadow-tab-warm"
                  : "font-semibold text-warm-ink hover:bg-surface-warm-2",
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon name={it.icon} size={18} />
                {it.label}
                {it.count != null && (
                  <span
                    className={cn(
                      "text-[11.5px] font-bold",
                      isActive ? "text-muted" : "text-warm-muted",
                    )}
                  >
                    {it.count}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
      {hint && <div className="ms-1.5 text-[12.5px] font-medium text-muted-2">{hint}</div>}
    </div>
  );
}
