import { useAuth } from "@/auth/auth-provider";
import { LoginPage } from "./LoginPage";
import { Workspace } from "./Workspace";

/** Session gate: loading → sign-in → the workspace. Protection here is UX; the API enforces every route. */
export function App() {
  const { status, me } = useAuth();
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
