import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { useSetPageChrome } from "@/lib/page-chrome";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/ui/page-container";
import { Icon } from "@/components/ui/icon";

const SECTIONS = [
  { to: "/settings", end: true, key: "firm", icon: "business", perm: "read:lawfirm_setting" },
  { to: "/settings/users", key: "users", icon: "manage_accounts", perm: "read:role" },
  { to: "/settings/practice", key: "practice", icon: "gavel", perm: "read:lawfirm_setting" },
  { to: "/settings/billing", key: "billing", icon: "payments", perm: "read:lawfirm_setting" },
  { to: "/settings/locale", key: "locale", icon: "translate", perm: null as string | null },
  { to: "/settings/assistant", key: "assistant", icon: "auto_awesome", perm: "read:lawfirm_setting" },
  { to: "/settings/audit", key: "audit", icon: "shield", perm: "read:audit_log" },
];

export function SettingsLayout() {
  const { t } = useTranslation("settings");
  const { can } = usePermissions();
  const visible = SECTIONS.filter((s) => s.perm === null || can(s.perm));

  useSetPageChrome({ title: t("title") });

  return (
    <PageContainer>
      <div className="grid items-start gap-3.5 md:grid-cols-[230px_1fr]">
        <nav className="rounded-card border border-border bg-surface p-2.5 md:sticky md:top-[80px]">
          {visible.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-btn px-3 py-2.5 text-[13px] transition-colors",
                  isActive
                    ? "bg-surface-sand font-bold text-link"
                    : "font-semibold text-secondary hover:bg-surface-subtle",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    name={s.icon}
                    size={18}
                    className={isActive ? "" : "text-muted"}
                  />
                  {t(`sections.${s.key}`)}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="flex min-w-0 flex-col gap-3.5">
          <Outlet />
        </div>
      </div>
    </PageContainer>
  );
}
