import { useRef } from "react";
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
  // Remember that this tab held a session: if it is lost (sign-out, expiry) the next person to sign in, possibly another
  // role, must start at their own home rather than the previous person's page.
  const hadSession = useRef(false);
  if (auth.status === "authenticated") hadSession.current = true;

  if (auth.status === "loading") return null;
  if (auth.status === "unauthenticated") {
    return <Navigate to="/login" replace state={hadSession.current ? undefined : { from: location.pathname }} />;
  }
  return <Outlet />;
}
