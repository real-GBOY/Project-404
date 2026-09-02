import { screen, waitFor, within } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { TasksListPage } from "./tasks-list-page";

describe("TasksListPage", () => {
  it("lists my tasks and completes one (which leaves the week view)", async () => {
    const { user } = renderApp(<TasksListPage />, {
      path: "/matters?tab=tasks",
      perms: ["read:task", "update:task"],
    });

    const title = await screen.findByText("Draft settlement memo for Al-Nour");
    const checkbox = within(title.closest("li") as HTMLElement).getByRole("checkbox");
    expect(checkbox).not.toBeChecked();
    await user.click(checkbox);
    await waitFor(() =>
      expect(screen.queryByText("Draft settlement memo for Al-Nour")).not.toBeInTheDocument(),
    );
  });

  it("disables completion without update permission", async () => {
    renderApp(<TasksListPage />, { path: "/matters?tab=tasks", perms: ["read:task"] });
    const item = (await screen.findByText("Draft settlement memo for Al-Nour")).closest("li") as HTMLElement;
    expect(within(item).getByRole("checkbox")).toBeDisabled();
  });
});
