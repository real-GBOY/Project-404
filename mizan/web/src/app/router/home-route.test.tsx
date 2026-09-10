import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { HomeRoute } from "./home-route";

function Tree() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <HomeRoute>
            <div>marketing page</div>
          </HomeRoute>
        }
      />
      <Route path="/dashboard" element={<div>app dashboard</div>} />
    </Routes>
  );
}

describe("HomeRoute", () => {
  it("holds on a loading indicator while the session bootstraps", () => {
    renderApp(<Tree />, { status: "loading" });
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.queryByText("marketing page")).not.toBeInTheDocument();
  });

  it("shows the public landing page to an anonymous visitor", () => {
    renderApp(<Tree />, { status: "anon" });
    expect(screen.getByText("marketing page")).toBeInTheDocument();
  });

  it("sends a signed-in visitor straight to the dashboard", () => {
    renderApp(<Tree />, { status: "authed" });
    expect(screen.getByText("app dashboard")).toBeInTheDocument();
  });
});
