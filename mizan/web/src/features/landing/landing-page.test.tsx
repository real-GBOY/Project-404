import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LandingPage } from "./landing-page";

function renderLanding() {
  return {
    user: userEvent.setup({ delay: null }),
    ...render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>,
    ),
  };
}

describe("LandingPage", () => {
  it("renders the hero and routes sign-in to /login", () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Run your firm with clarity.");
    const signIn = screen.getAllByRole("link", { name: "Sign in" });
    expect(signIn.length).toBeGreaterThan(0);
    signIn.forEach((link) => expect(link).toHaveAttribute("href", "/login"));
    expect(screen.getAllByRole("link", { name: /request a demo/i })[0].getAttribute("href")).toMatch(
      /^mailto:/,
    );
  });

  it("switches the product showcase when a tab is picked", async () => {
    const { user } = renderLanding();
    // default shot: Matters
    expect(screen.getByText("68 matters · filtered to active · sorted by next hearing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Invoices" }));

    expect(
      screen.getByText("EGP 14.2M billed YTD · EGP 9.84M collected · 69% collection rate"),
    ).toBeInTheDocument();
    expect(screen.getByText("Emirates Steel Fabrication")).toBeInTheDocument();
  });

  it("answers a different Ask Mizan question after a thinking pause", async () => {
    const { user } = renderLanding();

    await user.click(screen.getByRole("button", { name: /upcoming hearings for this client/i }));

    expect(
      await screen.findByText(
        "Two sessions are listed in the next six weeks across this client's open matters.",
        undefined,
        { timeout: 2000 },
      ),
    ).toBeInTheDocument();
  });

  it("moves the workflow detail panel to the selected stage", async () => {
    const { user } = renderLanding();

    expect(screen.getByText("The matter becomes the unit of work.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Resolution/ }));

    expect(screen.getByText("Stage 07 · Resolution")).toBeInTheDocument();
    expect(screen.getByText("Closed with its history intact.")).toBeInTheDocument();
  });
});
