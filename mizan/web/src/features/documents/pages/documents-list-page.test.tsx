import { http, HttpResponse } from "msw";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { server } from "@/test/msw/server";
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

  it("uploads via the three-step presigned flow (reserve → PUT bytes → confirm)", async () => {
    const calls: string[] = [];
    server.events.on("request:start", ({ request }) => {
      const u = new URL(request.url);
      if (u.pathname.startsWith("/api/documents") || u.pathname.startsWith("/api/_test-upload")) {
        calls.push(`${request.method} ${u.pathname}`);
      }
    });

    const { user } = renderApp(<DocumentsListPage />, {
      path: "/documents",
      perms: ["read:document", "upload:document"],
    });
    await screen.findByText(/Statement of Defence/);

    await user.click(screen.getByRole("button", { name: "Upload" }));
    const dialog = await screen.findByRole("dialog");
    const file = new File([new Uint8Array(2048)], "brief.pdf", { type: "application/pdf" });
    fireEvent.change(dialog.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });

    await user.click(within(dialog).getByRole("button", { name: "Upload" }));

    // Dialog only closes once confirm resolves.
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    const reserve = calls.findIndex((c) => c === "POST /api/documents");
    const put = calls.findIndex((c) => c.startsWith("PUT /api/_test-upload/"));
    const confirm = calls.findIndex((c) => /^POST \/api\/documents\/[^/]+\/confirm$/.test(c));
    expect(reserve).toBeGreaterThanOrEqual(0);
    expect(put).toBeGreaterThan(reserve);
    expect(confirm).toBeGreaterThan(put);

    expect(await screen.findByText("brief.pdf")).toBeInTheDocument();
    server.events.removeAllListeners("request:start");
  });

  it("previews a PDF inline in a dialog without downloading it", async () => {
    const viewed: string[] = [];
    server.events.on("request:start", ({ request }) => {
      const u = new URL(request.url);
      if (/^\/api\/documents\/[^/]+\/view$/.test(u.pathname)) viewed.push(u.pathname);
    });

    const { user } = renderApp(<DocumentsListPage />, {
      path: "/documents?view=grid",
      perms: ["read:document"],
    });

    const card = await screen.findByRole("button", { name: /Statement of Defence/ });
    await user.click(card);

    const dialog = await screen.findByRole("dialog");
    const frame = await waitFor(() => {
      const el = dialog.querySelector("iframe");
      if (!el) throw new Error("no iframe yet");
      return el as HTMLIFrameElement;
    });
    expect(frame).toHaveAttribute("src", "blob:mock/preview");
    expect(viewed).toContain("/api/documents/doc_1/view");

    server.events.removeAllListeners("request:start");
  });

  it("offers a download instead of an inline frame for a non-viewable type", async () => {
    const { user } = renderApp(<DocumentsListPage />, {
      path: "/documents?view=grid",
      perms: ["read:document"],
    });

    await user.click(await screen.findByRole("button", { name: /Distribution Agreement v3/ }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Inline preview isn't available/i)).toBeInTheDocument();
    expect(dialog.querySelector("iframe")).toBeNull();
    expect(within(dialog).getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("keeps the dialog open and surfaces an error when confirm fails", async () => {
    server.use(
      http.post("/api/documents/:id/confirm", () =>
        HttpResponse.json(
          { code: "files.upload_missing", message: "No uploaded object was found." },
          { status: 400 },
        ),
      ),
    );

    const { user } = renderApp(<DocumentsListPage />, {
      path: "/documents",
      perms: ["read:document", "upload:document"],
    });
    await screen.findByText(/Statement of Defence/);

    await user.click(screen.getByRole("button", { name: "Upload" }));
    const dialog = await screen.findByRole("dialog");
    const file = new File([new Uint8Array(1024)], "fails.pdf", { type: "application/pdf" });
    fireEvent.change(dialog.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [file] },
    });
    await user.click(within(dialog).getByRole("button", { name: "Upload" }));

    expect(await screen.findByText(/couldn't|failed|try again/i)).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
