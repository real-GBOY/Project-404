import { Route, Routes } from "react-router-dom";
import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { MattersListPage, MatterDetailPage } from "..";

function Harness() {
  return (
    <Routes>
      <Route path="/matters" element={<MattersListPage />} />
      <Route path="/matters/:id" element={<MatterDetailPage />} />
      <Route path="/clients/:id" element={<div>client</div>} />
    </Routes>
  );
}

describe("Matters", () => {
  it("lists matters and opens one", async () => {
    const { user } = renderApp(<Harness />, { path: "/matters", perms: ["read:matter"] });
    const link = await screen.findByText(/Al-Nour Trading v\. Delta Bank/);
    await user.click(link);
    expect(await screen.findByRole("tab", { name: /Overview/ })).toBeInTheDocument();
    expect(await screen.findByText("Matter team")).toBeInTheDocument();
  });

  it("gates the New matter action on create:matter", async () => {
    renderApp(<Harness />, { path: "/matters", perms: ["read:matter"] });
    await screen.findByText(/Al-Nour Trading v\. Delta Bank/);
    expect(screen.queryByRole("button", { name: "New matter" })).not.toBeInTheDocument();
  });
});
