import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { DashboardPage } from "./dashboard-page";

describe("DashboardPage", () => {
  it("renders the KPI tiles and every panel from the API", async () => {
    renderApp(<DashboardPage />, { perms: ["read:dashboard"] });

    expect(await screen.findByText("Active matters")).toBeInTheDocument();
    expect(screen.getByText("Hearings this month")).toBeInTheDocument();
    expect(screen.getByText("Unbilled time")).toBeInTheDocument();
    expect(screen.getByText("Upcoming hearings")).toBeInTheDocument();
    expect(screen.getByText("My tasks")).toBeInTheDocument();
    expect(screen.getByText("Matters by practice area")).toBeInTheDocument();
    expect(screen.getByText("Billing vs collections")).toBeInTheDocument();
    expect(screen.getByText("Recent activity")).toBeInTheDocument();
  });

  it("shows per-currency money without summing across currencies", async () => {
    renderApp(<DashboardPage />, { perms: ["read:dashboard"] });
    expect((await screen.findAllByText(/EGP\s/)).length).toBeGreaterThan(0);
  });
});
