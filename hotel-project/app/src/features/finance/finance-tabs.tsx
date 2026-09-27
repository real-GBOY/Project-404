import { NavLink } from "react-router-dom";
import { useAuth } from "@/features/auth/use-auth";
import { cn } from "@/lib/cn";

/** Sub-navigation between the finance screens, in the filter-pill language. */
export function FinanceTabs() {
  const auth = useAuth();
  const tabs = [
    auth.can("read:payment") && { to: "/payments", label: "Payments" },
    auth.can("read:payment") && { to: "/balances", label: "Balances" },
    auth.can("read:invoice") && { to: "/invoices", label: "Invoices" },
  ].filter(Boolean) as Array<{ to: string; label: string }>;
  if (tabs.length < 2) return null;
  return (
    <nav aria-label="Finance" className="mb-5 flex gap-2">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            cn(
              "rounded-control px-3.5 py-2 text-small font-semibold",
              isActive ? "bg-primary text-white" : "bg-neutral-soft text-ink-nav hover:bg-border",
            )
          }
        >
          {t.label}
        </NavLink>
      ))}
    </nav>
  );
}
