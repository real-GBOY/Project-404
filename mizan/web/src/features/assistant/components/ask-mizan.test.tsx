import { fireEvent, screen } from "@testing-library/react";
import { openOverlay, renderApp } from "@/test/render";
import { AskMizan } from "./ask-mizan";

describe("AskMizan", () => {
  it("answers a suggested prompt with a canned reply and marks actions as demo-only", () => {
    renderApp(<AskMizan />, { perms: [] });

    openOverlay(screen.getByRole("button", { name: "Open Ask Mizan" }), "click");
    fireEvent.click(screen.getByRole("button", { name: /What hearings are coming up/ }));

    expect(screen.getByText(/preview of the Mizan assistant/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Add a prep task/ }));
    expect(screen.getByText(/Demonstration only/)).toBeInTheDocument();
  });
});
