import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { ProtectedRoute } from "./protected-route";
import { RequirePermission } from "./require-permission";

function Tree() {
  return (
    <Routes>
      <Route path="/login" element={<div>login screen</div>} />
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<div>home</div>} />
        <Route path="/secret" element={<RequirePermission perm="read:matter" />}>
          <Route index element={<div>matters</div>} />
        </Route>
      </Route>
    </Routes>
  );
}

describe("ProtectedRoute", () => {
  it("holds on a loading indicator while the session bootstraps", () => {
    renderApp(<Tree />, { status: "loading" });
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("home")).not.toBeInTheDocument();
  });

  it("redirects an anonymous visitor to /login", () => {
    renderApp(<Tree />, { status: "anon" });
    expect(screen.getByText("login screen")).toBeInTheDocument();
  });

  it("renders the route for an authenticated user", () => {
    renderApp(<Tree />, { status: "authed" });
    expect(screen.getByText("home")).toBeInTheDocument();
  });
});

describe("RequirePermission", () => {
  it("renders the forbidden panel when the permission is missing", () => {
    renderApp(<Tree />, { path: "/secret", perms: [] });
    expect(screen.getByText("You don't have access")).toBeInTheDocument();
    expect(screen.queryByText("matters")).not.toBeInTheDocument();
  });

  it("renders the guarded route when the permission is held", () => {
    renderApp(<Tree />, { path: "/secret", perms: ["read:matter"] });
    expect(screen.getByText("matters")).toBeInTheDocument();
  });

  it("honours wildcard permissions", () => {
    renderApp(<Tree />, { path: "/secret", perms: ["read:*"] });
    expect(screen.getByText("matters")).toBeInTheDocument();
  });
});
