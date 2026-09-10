import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth/use-auth";
import { Spinner } from "@/components/ui/spinner";

/**
 * The site root (`/`). An anonymous visitor sees the public marketing page; a
 * signed-in visitor is sent straight into the app at `/dashboard`. While the
 * session bootstraps (`GET /api/me`) we hold on a full-page spinner so the
 * landing page never flashes for someone who is already logged in.
 */
export function HomeRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
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

  if (status === "authed") return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
