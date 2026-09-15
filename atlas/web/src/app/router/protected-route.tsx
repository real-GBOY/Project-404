import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-provider";

/**
 * Wraps the authenticated route tree. Renders nothing while the initial
 * `/me` check is in flight (avoids a `/login` flash on a hard refresh with a
 * valid session), redirects to `/login` once we know there's no session, and
 * remembers the attempted location so login can send the user back.
 */
export function ProtectedRoute() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === "loading") return null;
  if (auth.status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
