import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import { queryClient } from "@/lib/api/query-client";
import { i18n } from "@/lib/i18n";
import { WelcomePage } from "./welcome";

function renderWelcome() {
  return render(
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter>
          <WelcomePage />
        </MemoryRouter>
      </I18nextProvider>
    </QueryClientProvider>,
  );
}

describe("F0 scaffold", () => {
  it("renders the app name", () => {
    renderWelcome();
    expect(screen.getByText(/Mizan|ميزان/)).toBeInTheDocument();
  });

  it("formats per-currency money as separate lines (never summed)", () => {
    renderWelcome();
    const egp = screen.getByText(/4[.,\s]?360[.,\s]?000/);
    const aed = screen.getByText(/24[.,\s]?000/);
    expect(egp).toBeInTheDocument();
    expect(aed).toBeInTheDocument();
    expect(egp).not.toBe(aed);
  });
});
