import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { DashboardPage } from "./dashboard-page";

describe("DashboardPage", () => {
  it("renders KPIs and panels from the API", async () => {
    renderApp(<DashboardPage />, { perms: ["read:dashboard"] });

    expect(await screen.findByText("Active matters")).toBeInTheDocument();
    expect(await screen.findByText("Upcoming hearings")).toBeInTheDocument();
    expect(screen.getByText("My tasks")).toBeInTheDocument();
    expect(screen.getByText("Matters by practice area")).toBeInTheDocument();
    // per-currency money is rendered (never summed across currencies)
    expect((await screen.findAllByText(/EGP\s/)).length).toBeGreaterThan(0);
  });
});
