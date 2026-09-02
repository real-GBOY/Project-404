import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { RedirectIfAuthed } from "./redirect-if-authed";
import { RequireOrganization } from "./require-organization";

describe("RedirectIfAuthed", () => {
  function Tree() {
    return (
      <Routes>
        <Route element={<RedirectIfAuthed />}>
          <Route path="/login" element={<div>login form</div>} />
        </Route>
        <Route path="/" element={<div>app home</div>} />
      </Routes>
    );
  }

  it("shows the auth screen to an anonymous visitor", () => {
    renderApp(<Tree />, { path: "/login", status: "anon" });
    expect(screen.getByText("login form")).toBeInTheDocument();
  });

  it("bounces a signed-in visitor into the app", () => {
    renderApp(<Tree />, { path: "/login", status: "authed" });
    expect(screen.getByText("app home")).toBeInTheDocument();
  });
});

describe("RequireOrganization", () => {
  function Tree() {
    return (
      <Routes>
        <Route element={<RequireOrganization />}>
          <Route path="/matters" element={<div>matters list</div>} />
        </Route>
        <Route path="/login/organization" element={<div>org picker</div>} />
      </Routes>
    );
  }

  it("lets a tenant-scoped session through", () => {
    renderApp(<Tree />, { path: "/matters", activeOrg: "org_1" });
    expect(screen.getByText("matters list")).toBeInTheDocument();
  });

  it("sends an orgless session to the picker", () => {
    renderApp(<Tree />, { path: "/matters", activeOrg: null, organizations: [] });
    expect(screen.getByText("org picker")).toBeInTheDocument();
  });
});
