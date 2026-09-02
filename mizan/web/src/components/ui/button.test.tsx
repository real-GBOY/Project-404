import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button } from "./button";
import { IconButton } from "./icon-button";

describe("Button", () => {
  it("fires onClick when activated by keyboard", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);

    await user.tab();
    expect(screen.getByRole("button", { name: "Save" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("blocks interaction and marks busy while loading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );

    const btn = screen.getByRole("button", { name: "Save" });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    await user.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders as a link when asChild is set", () => {
    render(
      <Button asChild>
        <a href="/clients">Clients</a>
      </Button>,
    );
    expect(screen.getByRole("link", { name: "Clients" })).toHaveAttribute("href", "/clients");
  });
});

describe("IconButton", () => {
  it("requires and exposes an accessible name", () => {
    render(<IconButton icon="close" aria-label="Close panel" />);
    expect(screen.getByRole("button", { name: "Close panel" })).toBeInTheDocument();
  });
});
