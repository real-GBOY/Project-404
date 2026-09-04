import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { TeamPage } from "./team-page";

describe("TeamPage", () => {
  it("lists team members with utilisation", async () => {
    renderApp(<TeamPage />, { path: "/team", perms: ["read:staff"] });
    expect(await screen.findByText("Mahmoud Nayel")).toBeInTheDocument();
    expect(screen.getAllByText("Utilisation").length).toBeGreaterThan(0);
  });
});
