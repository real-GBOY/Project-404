import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { NotificationsPage } from "./notifications-page";

describe("NotificationsPage", () => {
  it("lists notifications and filters to unread", async () => {
    const { user } = renderApp(<NotificationsPage />, { path: "/notifications", perms: [] });

    expect(await screen.findByText(/Hearing scheduled/)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Unread" }));
    expect(await screen.findByText(/Payment received/)).toBeInTheDocument();
  });
});
