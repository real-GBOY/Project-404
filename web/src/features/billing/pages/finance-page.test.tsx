import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { FinancePage } from "./finance-page";
import { InvoiceDetailPage } from "./invoice-detail-page";

function Harness() {
  return (
    <Routes>
      <Route path="/billing" element={<FinancePage />} />
      <Route path="/billing/invoices/:id" element={<InvoiceDetailPage />} />
      <Route path="/clients/:id" element={<div>client</div>} />
      <Route path="/matters/:id" element={<div>matter</div>} />
    </Routes>
  );
}

describe("Finance", () => {
  it("lists invoices and opens one with server-computed totals", async () => {
    const { user } = renderApp(<Harness />, {
      path: "/billing",
      perms: ["read:invoice", "read:payment", "read:expense"],
    });

    await user.click(await screen.findByText("INV-2026-0128"));
    expect(await screen.findByText("Balance due")).toBeInTheDocument();
    expect(screen.getByText(/VAT \(14%\)/)).toBeInTheDocument();
  });

  it("switches to the payments tab", async () => {
    const { user } = renderApp(<Harness />, {
      path: "/billing",
      perms: ["read:invoice", "read:payment", "read:expense"],
    });
    await user.click(await screen.findByRole("tab", { name: /Payments/ }));
    // pay_2 → inv_6 (INV-2026-0119), EGP 108,300
    expect(await screen.findByText("INV-2026-0119")).toBeInTheDocument();
  });
});
