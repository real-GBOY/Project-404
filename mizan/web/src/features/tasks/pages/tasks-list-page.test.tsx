import { screen, waitFor } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { TasksListPage } from "./tasks-list-page";

function rowOf(title: string) {
  return (
    screen.getByText(title).closest("[data-slot='list-row']") ??
    screen.getByText(title).closest("div")
  ) as HTMLElement;
}

describe("TasksListPage", () => {
  it("lists tasks and completes one (which leaves a non-'all' view)", async () => {
    const { user } = renderApp(<TasksListPage />, {
      path: "/matters?tab=tasks&range=week&mine=everyone",
      perms: ["read:task", "update:task"],
    });

    const title = await screen.findByText("Draft settlement memo for Al-Nour");
    const checkbox = rowOf("Draft settlement memo for Al-Nour").querySelector(
      "[role='checkbox']",
    ) as HTMLElement;
    expect(checkbox).not.toBeNull();
    await user.click(checkbox);
    await waitFor(() => expect(screen.queryByText(title.textContent!)).not.toBeInTheDocument());
  });

  it("disables completion without update permission", async () => {
    renderApp(<TasksListPage />, {
      path: "/matters?tab=tasks&range=all&mine=everyone",
      perms: ["read:task"],
    });
    await screen.findByText("Draft settlement memo for Al-Nour");
    const checkbox = rowOf("Draft settlement memo for Al-Nour").querySelector(
      "[role='checkbox']",
    ) as HTMLElement;
    expect(checkbox).toBeDisabled();
  });
});
