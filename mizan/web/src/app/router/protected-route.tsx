import { useRef } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/use-auth";
import { Spinner } from "@/components/ui/spinner";

/**
 * Session gate. While the session bootstraps (`GET /api/me`) we hold on a
 * full-page spinner; an anonymous visitor is bounced to `/login` with the
 * attempted path so it can be restored after sign-in.
 */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();
  // Remember that this tab held a session: if it is lost (sign-out, expiry) the next person to sign in, possibly another
  // role, must start at their own home rather than the previous person's page.
  const hadSession = useRef(false);
  if (status === "authed") hadSession.current = true;
  const { t } = useTranslation("common");

  if (status === "loading") {
    return (
      <div
        className="flex min-h-dvh items-center justify-center bg-canvas"
        role="status"
        aria-label={t("states.loading")}
      >
        <Spinner size={28} className="text-muted" />
      </div>
    );
  }

  if (status === "anon") {
    return <Navigate to="/login" replace state={hadSession.current ? undefined : { from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}
