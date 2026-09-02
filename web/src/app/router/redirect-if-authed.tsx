import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/lib/auth/use-auth";
import { Spinner } from "@/components/ui/spinner";

/**
 * Wraps the public auth screens. A signed-in visitor is sent to the app instead
 * of seeing the login form again.
 */
export function RedirectIfAuthed() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex min-h-40 items-center justify-center">
        <Spinner size={24} className="text-muted" />
      </div>
    );
  }
  if (status === "authed") return <Navigate to="/" replace />;
  return <Outlet />;
}
