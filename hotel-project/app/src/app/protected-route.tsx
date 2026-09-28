import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/use-auth";

/**
 * Wraps the authenticated route tree. Renders nothing while the initial `/me` check is in flight
 * (no `/login` flash on a hard refresh with a valid session), redirects to `/login` once there is
 * no session, and remembers the attempted location so sign-in returns the user there.
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
