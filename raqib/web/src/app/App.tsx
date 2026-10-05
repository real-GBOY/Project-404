import { useAuth } from "@/auth/auth-provider";
import { LoginPage } from "./LoginPage";
import { PasswordSetupPage, PublicRequestPage } from "./PublicPages";
import { Workspace } from "./Workspace";

/** Session gate: loading → sign-in → the workspace. Protection here is UX; the API enforces every route. */
export function App() {
  const { status, me } = useAuth();
  // the two pages an anonymous person may use besides sign-in: the account request and the emailed password setup
  const path = window.location.pathname;
  const reqOrg = /^\/request-account\/([^/]+)\/?$/.exec(path)?.[1];
  if (reqOrg) return <PublicRequestPage org={decodeURIComponent(reqOrg)} />;
  if (path === "/reset-password") return <PasswordSetupPage />;
  if (status === "loading") {
    return (
      <div role="status" aria-busy="true" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#5C6168", fontFamily: "'IBM Plex Sans',system-ui,sans-serif" }}>
        …
      </div>
    );
  }
  if (status === "unauthenticated" || !me) return <LoginPage />;
  return <Workspace me={me} />;
}
