import { fireEvent, screen } from "@testing-library/react";
import { openOverlay, renderWithProviders } from "@/test/render";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

// See openOverlay — Radix Popper overlays must be driven synchronously in jsdom.

describe("DropdownMenu", () => {
  it("opens on trigger and runs the chosen item", () => {
    const onArchive = vi.fn();
    renderWithProviders(
      <DropdownMenu>
        <DropdownMenuTrigger>Actions</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onArchive}>Archive</DropdownMenuItem>
          <DropdownMenuItem destructive>Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    openOverlay(screen.getByRole("button", { name: "Actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Archive" }));
    expect(onArchive).toHaveBeenCalledOnce();
  });
});

describe("Select", () => {
  it("opens and selects an option", () => {
    renderWithProviders(
      <Select>
        <SelectTrigger aria-label="Court">
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="cairo">Cairo</SelectItem>
          <SelectItem value="giza">Giza</SelectItem>
        </SelectContent>
      </Select>,
    );

    const trigger = screen.getByRole("combobox", { name: "Court" });
    expect(trigger).toHaveTextContent("Choose");
    openOverlay(trigger);
    fireEvent.click(screen.getByRole("option", { name: "Giza" }));
    expect(trigger).toHaveTextContent("Giza");
  });
});
