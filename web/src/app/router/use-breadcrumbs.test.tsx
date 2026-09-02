import { screen } from "@testing-library/react";
import { useBreadcrumbs } from "./use-breadcrumbs";
import { renderApp } from "@/test/render";

function Probe() {
  const crumbs = useBreadcrumbs();
  return <div>{crumbs.map((c) => c.label).join(" / ")}</div>;
}

describe("useBreadcrumbs", () => {
  it("returns just the dashboard at the root", () => {
    renderApp(<Probe />, { path: "/" });
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("prepends a dashboard crumb for a section", () => {
    renderApp(<Probe />, { path: "/matters" });
    expect(screen.getByText("Dashboard / Matters")).toBeInTheDocument();
  });

  it("resolves the section from a nested path", () => {
    renderApp(<Probe />, { path: "/billing/invoices/inv_1" });
    expect(screen.getByText("Dashboard / Finance")).toBeInTheDocument();
  });
});
