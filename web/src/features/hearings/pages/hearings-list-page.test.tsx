import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { HearingsListPage } from "./hearings-list-page";

describe("HearingsListPage", () => {
  it("shows upcoming hearings by default and can switch to past", async () => {
    const { user } = renderApp(<HearingsListPage />, {
      path: "/matters?tab=hearings",
      perms: ["read:hearing"],
    });

    expect(await screen.findByText(/Merits hearing/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Past" }));
    expect(await screen.findByText(/Adjourned at the court's motion/)).toBeInTheDocument();
  });
});
