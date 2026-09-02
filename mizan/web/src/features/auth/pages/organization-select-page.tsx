import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/use-auth";
import { useOrganization } from "@/lib/tenant/use-organization";
import { isApiError } from "@/lib/api/api-error";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Spinner } from "@/components/ui/spinner";
import { AuthHeader } from "../components/auth-header";

export function OrganizationSelectPage() {
  const { t } = useTranslation("auth");
  const { memberships, selectOrganization, logout } = useAuth();
  const { organizationId } = useOrganization();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Already scoped to an org — nothing to choose here.
  if (organizationId) return <Navigate to={from} replace />;

  async function choose(id: string) {
    setError(null);
    setPendingId(id);
    try {
      await selectOrganization(id);
      navigate(from, { replace: true });
    } catch (err) {
      setError(isApiError(err) ? err.message : t("org_select.error"));
      setPendingId(null);
    }
  }

  if (memberships.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <AuthHeader title={t("org_select.none_title")} subtitle={t("org_select.none_subtitle")} />
        <Button variant="secondary" onClick={() => void logout()} className="w-full">
          {t("org_select.back_to_login")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <AuthHeader title={t("org_select.title")} subtitle={t("org_select.subtitle")} />

      {error && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-surface px-3 py-2 text-[12.5px] font-medium text-danger"
        >
          {error}
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {memberships.map((org) => {
          const busy = pendingId === org.organizationId;
          return (
            <li key={org.organizationId}>
              <button
                type="button"
                disabled={pendingId !== null}
                onClick={() => void choose(org.organizationId)}
                className="flex w-full items-center gap-3 rounded-lg border border-border-control bg-surface px-3 py-3 text-start transition-colors hover:border-border-accent hover:bg-surface-subtle disabled:opacity-60"
              >
                <span className="flex size-9 flex-none items-center justify-center rounded-md bg-surface-sand text-link">
                  <Icon name="business" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold text-foreground">
                    {org.name}
                  </span>
                  <span className="block truncate text-[11.5px] text-muted">{org.membershipRole}</span>
                </span>
                {busy ? (
                  <Spinner size={16} className="text-muted" />
                ) : (
                  <Icon name="chevron_right" size={18} className="flex-none text-subtle rtl:rotate-180" />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => void logout()}
        className="text-[12.5px] font-semibold text-muted hover:text-foreground-body"
      >
        {t("org_select.back_to_login")}
      </button>
    </div>
  );
}
