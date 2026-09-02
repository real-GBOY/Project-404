import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/render";
import { CommandMenu, type CommandAction } from "./command-menu";

function actions(): CommandAction[] {
  return [
    { id: "matters", label: "Go to Matters", group: "Navigate", perform: vi.fn() },
    { id: "clients", label: "Go to Clients", group: "Navigate", perform: vi.fn() },
    { id: "new-matter", label: "New matter", group: "Create", keywords: ["case"], perform: vi.fn() },
  ];
}

describe("CommandMenu", () => {
  it("filters by label and keyword, then runs the highlighted action on Enter", async () => {
    const list = actions();
    const { user } = renderWithProviders(
      <CommandMenu open onOpenChange={() => {}} actions={list} />,
    );

    // groups render when unfiltered
    expect(screen.getByText("Navigate")).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();

    await user.keyboard("case"); // matches "New matter" via its keyword
    expect(screen.queryByRole("button", { name: "Go to Matters" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New matter" })).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(list[2].perform).toHaveBeenCalledOnce();
  });

  it("renders no actions when nothing matches", async () => {
    const list = actions();
    const { user } = renderWithProviders(
      <CommandMenu open onOpenChange={() => {}} actions={list} />,
    );
    await user.keyboard("zzzzz");
    for (const action of list) {
      expect(screen.queryByRole("button", { name: action.label })).not.toBeInTheDocument();
    }
  });
});
