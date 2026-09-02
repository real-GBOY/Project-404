import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { PageChromeProvider, usePageChrome, useSetPageChrome } from "./page-chrome";

/** Reads what the top bar would show. */
function ChromeReadout() {
  const chrome = usePageChrome();
  return <div data-testid="chrome">{chrome ? `${chrome.title}/${chrome.count ?? ""}` : "none"}</div>;
}

function PageA() {
  useSetPageChrome({ title: "Clients", count: 48 });
  return <div>page A content</div>;
}

function PageB() {
  useSetPageChrome({ title: "Al-Ahram", parent: { label: "Clients", to: "/clients" } });
  return <div>page B content</div>;
}

function Harness() {
  const [page, setPage] = useState<"a" | "b">("a");
  return (
    <PageChromeProvider>
      <ChromeReadout />
      <button type="button" onClick={() => setPage((p) => (p === "a" ? "b" : "a"))}>
        swap
      </button>
      {page === "a" ? <PageA /> : <PageB />}
    </PageChromeProvider>
  );
}

describe("page-chrome", () => {
  it("renders a chrome-declaring page and surfaces its title without looping", () => {
    // A render loop here would throw "Maximum update depth exceeded".
    render(<Harness />);
    expect(screen.getByText("page A content")).toBeInTheDocument();
    expect(screen.getByTestId("chrome")).toHaveTextContent("Clients/48");
  });

  it("swaps chrome on navigation and clears it back to the default", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "swap" }));
    expect(screen.getByText("page B content")).toBeInTheDocument();
    expect(screen.getByTestId("chrome")).toHaveTextContent("Al-Ahram");

    fireEvent.click(screen.getByRole("button", { name: "swap" }));
    expect(screen.getByTestId("chrome")).toHaveTextContent("Clients/48");
  });
});
