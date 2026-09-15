import { Navigate } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-provider";
import { LandingPage } from "@/features/landing";

/**
 * The site root (`/`). An anonymous visitor sees the public marketing page; a
 * signed-in visitor is sent straight into the app at `/dashboard`. Mirrors
 * `ProtectedRoute`'s "render nothing while the session check is in flight"
 * convention so neither page flashes on a hard refresh.
 */
export function RootRoute() {
  const auth = useAuth();
  if (auth.status === "loading") return null;
  if (auth.status === "authenticated") return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}
