import { fireEvent, screen, waitFor } from "@testing-library/react";
import { openOverlay, renderApp } from "@/test/render";
import { AskMizan } from "./ask-mizan";

function open() {
  renderApp(<AskMizan />, { perms: ["use:assistant"] });
  openOverlay(screen.getByRole("button", { name: "Open Ask Mizan" }), "click");
}

async function ask(text: string) {
  fireEvent.change(screen.getByPlaceholderText(/Ask about hearings/), { target: { value: text } });
  fireEvent.submit(screen.getByPlaceholderText(/Ask about hearings/).closest("form")!);
}

describe("AskMizan", () => {
  it("is hidden for a user without use:assistant", () => {
    renderApp(<AskMizan />, { perms: [] });
    expect(screen.queryByRole("button", { name: "Open Ask Mizan" })).not.toBeInTheDocument();
  });

  it("sends a message and renders the assistant reply with tool activity", async () => {
    open();
    await ask("What hearings do I have this week?");

    expect(await screen.findByText(/2 hearings this week/)).toBeInTheDocument();
    // the tool chip is labelled from i18n
    expect(screen.getByText("Read hearings")).toBeInTheDocument();
  });

  it("shows an error with a retry when the request fails", async () => {
    open();
    await ask("please fail this one");

    expect(await screen.findByText(/temporarily unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("keeps the same conversation across turns", async () => {
    open();
    await ask("hello there");
    await screen.findByText(/I can help with hearings/);

    await ask("and my overdue tasks?");
    await waitFor(() =>
      expect(screen.getByText(/1 overdue task/)).toBeInTheDocument(),
    );
    // both user turns are shown
    expect(screen.getByText("hello there")).toBeInTheDocument();
    expect(screen.getByText("and my overdue tasks?")).toBeInTheDocument();
  });
});
