import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/auth-context";
import { AccountSecurityPage } from "@/features/account/AccountSecurityPage";
import { ForgotPasswordPage } from "@/features/account/ForgotPasswordPage";
import { LoginPage } from "@/features/auth/LoginPage";
import { LandingPage } from "@/features/landing";
import { PasswordSetupPage } from "@/features/onboarding/PasswordSetupPage";
import { PublicRequestPage } from "@/features/onboarding/PublicRequestPage";
import { Workspace } from "./Workspace";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

/** Session gate: loading → the public landing page at `/` or sign-in → (account set-up the organization requires) → the workspace. Protection here is UX; the API enforces every route. */
export function App() {
  const { status, me, security, error } = useAuth();
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
          color: C.text.secondary,
          fontFamily: FONT.latin,
        }}
      >
        …
      </div>
    );
  }
  // a sign-out the person did not choose (expired, idle) goes to sign-in so its reason is shown
  if (status === "unauthenticated" || !me)
    return path === "/" && !error ? <LandingPage /> : <LoginPage />;
  // signed in on the sign-in address (just logged in): continue into the workspace
  if (path === "/login") return <Navigate to="/" replace />;
  // a required second factor / an expired password blocks the workspace (the backend refuses every other route meanwhile)
  if (security?.setupRequired.length) return <AccountSecurityPage forced />;
  if (path === "/account/security") return <AccountSecurityPage />;
  return <Workspace me={me} />;
}
