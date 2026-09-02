import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/use-auth";
import { useOrganization } from "@/lib/tenant/use-organization";
import { useToast } from "@/components/ui/toast-context";
import { Icon } from "@/components/ui/icon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string) {
  return name
    .replace(/[^A-Za-z؀-ۿ ]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/**
 * Sidebar-footer account card — the prototype's user card
 * (`border:1px solid #ECECF1; border-radius:12px; padding:10px`). Opens the
 * account menu (org switch, language, sign out).
 */
export function UserMenu() {
  const { t, i18n } = useTranslation("common");
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { organization, organizations, switchTo } = useOrganization();
  const toast = useToast();
  const [switching, setSwitching] = useState(false);

  const name = user?.displayName ?? user?.email ?? "";
  const subtitle = organization?.name ?? user?.email ?? "";

  async function handleSwitch(orgId: string) {
    if (orgId === organization?.organizationId || switching) return;
    try {
      setSwitching(true);
      await switchTo(orgId);
      toast.success({ title: t("shell.org_switched") });
    } catch {
      toast.error({ title: t("states.error_title") });
    } finally {
      setSwitching(false);
    }
  }

  const otherLocale = i18n.language.startsWith("ar") ? "en" : "ar";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("shell.user_menu")}
        className="flex w-full items-center gap-2.5 rounded-panel border border-border p-2.5 text-start transition-colors hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <span className="flex size-[34px] flex-none items-center justify-center rounded-full bg-border-warm text-[12.5px] font-extrabold text-primary-deep">
          {initials(name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-bold text-foreground">{name}</span>
          <span className="block truncate text-[11px] font-medium text-muted">{subtitle}</span>
        </span>
        <Icon name="chevron_right" size={18} className="flex-none text-faint rtl:rotate-180" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" side="top" className="min-w-56">
        <DropdownMenuLabel>
          <div className="truncate text-[12.5px] font-bold text-foreground">{name}</div>
          {user?.email && (
            <div className="truncate text-[11px] font-medium text-muted">{user.email}</div>
          )}
        </DropdownMenuLabel>

        {organizations.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t("shell.organizations")}</DropdownMenuLabel>
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.organizationId}
                icon={org.organizationId === organization?.organizationId ? "check" : "business"}
                onSelect={(e) => {
                  e.preventDefault();
                  void handleSwitch(org.organizationId);
                }}
              >
                <span className="truncate">{org.name}</span>
              </DropdownMenuItem>
            ))}
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem icon="settings" onSelect={() => navigate("/settings")}>
          {t("nav.settings")}
        </DropdownMenuItem>
        <DropdownMenuItem
          icon="translate"
          onSelect={(e) => {
            e.preventDefault();
            void i18n.changeLanguage(otherLocale);
          }}
        >
          {t(`language.${otherLocale}`)}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem icon="logout" destructive onSelect={() => void logout()}>
          {t("shell.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
