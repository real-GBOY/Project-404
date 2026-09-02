import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { ClientsListPage } from "./clients-list-page";

function Harness() {
  return (
    <Routes>
      <Route path="/clients" element={<ClientsListPage />} />
      <Route path="/clients/:id" element={<div>client detail</div>} />
    </Routes>
  );
}

describe("ClientsListPage", () => {
  it("lists clients from the API and opens one on row click", async () => {
    const { user } = renderApp(<Harness />, { path: "/clients", perms: ["read:client"] });

    const row = await screen.findByText("Al-Nour Trading Co.");
    await user.click(row);
    expect(await screen.findByText("client detail")).toBeInTheDocument();
  });

  it("renders the KPI summary and pagination footer", async () => {
    renderApp(<Harness />, { path: "/clients", perms: ["read:client"] });
    await screen.findByText("Al-Nour Trading Co.");
    expect(screen.getByText("Total clients")).toBeInTheDocument();
    expect(screen.getByText(/Showing 1–/)).toBeInTheDocument();
  });

  it("hides the add-client action without create permission", async () => {
    renderApp(<Harness />, { path: "/clients", perms: ["read:client"] });
    await screen.findByText("Al-Nour Trading Co.");
    expect(screen.queryByRole("button", { name: "Add Client" })).not.toBeInTheDocument();
  });

  it("shows the add-client action with permission", async () => {
    renderApp(<Harness />, { path: "/clients", perms: ["read:client", "create:client"] });
    expect(await screen.findAllByRole("button", { name: "Add Client" })).not.toHaveLength(0);
  });
});
