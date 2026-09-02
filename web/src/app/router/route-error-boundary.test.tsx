import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { RouteErrorBoundary } from "./route-error-boundary";

function Boom(): never {
  throw new Error("route blew up");
}

describe("RouteErrorBoundary", () => {
  it("catches a render error in the routed content and offers a retry", () => {
    renderApp(
      <RouteErrorBoundary>
        <Routes>
          <Route path="/" element={<Boom />} />
        </Routes>
      </RouteErrorBoundary>,
    );
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
