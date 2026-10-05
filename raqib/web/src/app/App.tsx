import { useLocation } from "react-router-dom";
import { useAuth } from "@/auth/auth-provider";
import { AccountSecurityPage, ForgotPasswordPage } from "./AccountPages";
import { LoginPage } from "./LoginPage";
import { PasswordSetupPage, PublicRequestPage } from "./PublicPages";
import { Workspace } from "./Workspace";

/** Session gate: loading → sign-in → (account set-up the organization requires) → the workspace. Protection here is UX; the API enforces every route. */
export function App() {
  const { status, me, security } = useAuth();
  const path = useLocation().pathname;
  // the pages an anonymous person may use besides sign-in: the account request, password recovery and the emailed password setup
  const reqOrg = /^\/request-account\/([^/]+)\/?$/.exec(path)?.[1];
  if (reqOrg) return <PublicRequestPage org={decodeURIComponent(reqOrg)} />;
  if (path === "/reset-password") return <PasswordSetupPage />;
  if (path === "/forgot-password") return <ForgotPasswordPage />;
  if (status === "loading") {
    return (
      <div
        role="status"
        aria-busy="true"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#5C6168",
          fontFamily: "'IBM Plex Sans',system-ui,sans-serif",
        }}
      >
        …
      </div>
    );
  }
  if (status === "unauthenticated" || !me) return <LoginPage />;
  // a required second factor / an expired password blocks the workspace (the backend refuses every other route meanwhile)
  if (security?.setupRequired.length) return <AccountSecurityPage forced />;
  if (path === "/account/security") return <AccountSecurityPage />;
  return <Workspace me={me} />;
}
