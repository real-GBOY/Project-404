import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/lib/permissions/use-permissions";
import { cn } from "@/lib/cn";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeader } from "@/components/ui/page-header";
import { Icon } from "@/components/ui/icon";

const SECTIONS = [
  { to: "/settings", end: true, key: "firm", icon: "business", perm: "read:lawfirm_setting" },
  { to: "/settings/practice", key: "practice", icon: "gavel", perm: "read:lawfirm_setting" },
  { to: "/settings/billing", key: "billing", icon: "payments", perm: "read:lawfirm_setting" },
  { to: "/settings/assistant", key: "assistant", icon: "auto_awesome", perm: "read:lawfirm_setting" },
  { to: "/settings/users", key: "users", icon: "manage_accounts", perm: "read:role" },
  { to: "/settings/audit", key: "audit", icon: "shield", perm: "read:audit_log" },
  { to: "/settings/locale", key: "locale", icon: "translate", perm: null as string | null },
];

export function SettingsLayout() {
  const { t } = useTranslation("settings");
  const { can } = usePermissions();
  const visible = SECTIONS.filter((s) => s.perm === null || can(s.perm));

  return (
    <PageContainer>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <div className="grid gap-6 md:grid-cols-[13rem_1fr]">
        <nav className="flex flex-col gap-0.5 md:sticky md:top-20 md:self-start">
          {visible.map((s) => (
            <NavLink
              key={s.to}
              to={s.to}
              end={s.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-[12.5px] font-semibold",
                  isActive ? "bg-surface-sand text-link" : "text-foreground-body hover:bg-surface-subtle",
                )
              }
            >
              <Icon name={s.icon} size={16} />
              {t(`sections.${s.key}`)}
            </NavLink>
          ))}
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </PageContainer>
  );
}
