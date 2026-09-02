import { screen } from "@testing-library/react";
import { renderApp } from "@/test/render";
import { DocumentsListPage } from "./documents-list-page";

describe("DocumentsListPage", () => {
  it("lists documents from the API", async () => {
    renderApp(<DocumentsListPage />, { path: "/documents", perms: ["read:document"] });
    expect(await screen.findByText("Statement of Defence — Al-Nour.pdf")).toBeInTheDocument();
  });

  it("gates upload on create:document", async () => {
    renderApp(<DocumentsListPage />, { path: "/documents", perms: ["read:document"] });
    await screen.findByText(/Statement of Defence/);
    expect(screen.queryByRole("button", { name: "Upload" })).not.toBeInTheDocument();
  });
});
