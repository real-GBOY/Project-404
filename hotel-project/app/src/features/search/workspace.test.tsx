import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, renderApp, stubApi } from "@/test/render";
import { AppShell } from "@/app/layouts/app-shell";
import { StaffPage } from "@/features/staff/staff-page";
import { GuestDocuments } from "@/features/guests/guest-documents";

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

const shell = (
  <Routes>
    <Route element={<AppShell />}>
      <Route path="*" element={<Where />} />
    </Route>
  </Routes>
);

describe("Command palette", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("opens with ⌘K, searches the server and opens the chosen record with Enter", async () => {
    const asked: string[] = [];
    stubApi({
      permissions: ["read:reservation", "read:guest"],
      routes: [
        (url) => {
          if (!url.pathname.endsWith("/hotel/search")) return undefined;
          asked.push(url.searchParams.get("q")!);
          return json(200, {
            groups: [
              {
                key: "guests",
                label: "Guests",
                items: [
                  { id: "g1", title: "Karim Fathy", subtitle: "+20 111", href: "/guests/g1" },
                ],
              },
              {
                key: "reservations",
                label: "Reservations",
                items: [
                  {
                    id: "r1",
                    title: "#BK-1042 · Karim Fathy",
                    subtitle: null,
                    href: "/reservations/r1",
                  },
                ],
              },
            ],
          });
        },
        (url) =>
          url.pathname.endsWith("/notifications")
            ? json(200, { notifications: [], unreadCount: 0 })
            : undefined,
      ],
    });
    renderApp(shell, "/");
    await screen.findByRole("button", { name: "Search guests, bookings, rooms" });
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const box = await screen.findByRole("combobox");
    await userEvent.setup().type(box, "karim");
    expect(await screen.findByRole("option", { name: /#BK-1042/ })).toBeInTheDocument();
    fireEvent.keyDown(box, { key: "ArrowDown" });
    fireEvent.keyDown(box, { key: "Enter" });
    expect(screen.getByTestId("where")).toHaveTextContent("/reservations/r1");
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(asked.at(-1)).toBe("karim");
  });
});

describe("Notifications", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows unread, and opening one marks it read and goes to its record", async () => {
    const reads: string[] = [];
    stubApi({
      permissions: [],
      routes: [
        (url, init) => {
          if (init?.method === "POST" && url.pathname.includes("/notifications/")) {
            reads.push(url.pathname);
            return new Response(null, { status: 204 });
          }
          return url.pathname.endsWith("/notifications")
            ? json(200, {
                unreadCount: 1,
                notifications: [
                  {
                    id: "ntf_1",
                    type: "hotel.maintenance_assigned",
                    title: "MT-104 assigned to you",
                    body: "Room 207: AC not cooling (high).",
                    data: { href: "/maintenance/mtk_1" },
                    read: false,
                    createdAt: new Date().toISOString(),
                  },
                ],
              })
            : undefined;
        },
      ],
    });
    renderApp(shell, "/");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "Notifications, 1 unread" }));
    const panel = screen.getByRole("dialog", { name: "Notifications" });
    expect(within(panel).getByText("Just now · Maintenance")).toBeInTheDocument();
    await user.click(within(panel).getByRole("button", { name: /MT-104 assigned to you/ }));
    expect(screen.getByTestId("where")).toHaveTextContent("/maintenance/mtk_1");
    expect(reads).toEqual(["/api/notifications/ntf_1/read"]);
  });
});

describe("Audit log", () => {
  afterEach(() => vi.unstubAllGlobals());

  const routes = [
    (url: URL) => (url.pathname.endsWith("/hotel/staff") ? json(200, { items: [] }) : undefined),
    (url: URL) =>
      url.pathname.endsWith("/hotel/activity")
        ? json(200, {
            nextCursor: null,
            items: [
              {
                id: "a1",
                actorName: "Rania Kamal",
                verb: "cancelled reservation",
                subject: "#BK-1042",
                href: "/reservations/r1",
                detail: "Plans changed",
                action: "hotel.reservation.cancelled",
                severity: "warning",
                at: new Date().toISOString(),
              },
            ],
          })
        : undefined,
  ];

  it("reads the trail as sentences with links, for those allowed", async () => {
    stubApi({ permissions: ["read:staff", "read:audit_log"], routes });
    renderApp(<StaffPage />, "/staff");
    await userEvent.setup().click(await screen.findByRole("tab", { name: "Audit Log" }));
    const link = await screen.findByRole("link", { name: "#BK-1042" });
    expect(link).toHaveAttribute("href", "/reservations/r1");
    expect(link.parentElement).toHaveTextContent("Rania Kamal cancelled reservation #BK-1042");
    expect(screen.getByText("Plans changed")).toBeInTheDocument();
  });

  it("isn't offered without read:audit_log", async () => {
    stubApi({ permissions: ["read:staff"], routes });
    renderApp(<StaffPage />, "/staff");
    await screen.findByRole("tab", { name: "Directory" });
    expect(screen.queryByRole("tab", { name: "Audit Log" })).not.toBeInTheDocument();
  });
});

describe("Guest documents", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("uploads through Core (presign → PUT → confirm) and only then attaches", async () => {
    const calls: string[] = [];
    let attached: unknown;
    stubApi({
      permissions: ["read:guest", "update:guest", "upload:file", "read:file"],
      routes: [
        (url, init) => {
          const m = init?.method ?? "GET";
          if (url.pathname.endsWith("/files/uploads")) {
            calls.push("presign");
            return json(201, {
              fileId: "fil_1",
              upload: { url: "/files/fil_1/bytes", method: "PUT", headers: {} },
            });
          }
          if (url.pathname.endsWith("/files/fil_1/bytes") && m === "PUT") {
            calls.push("put");
            return new Response(null, { status: 204 });
          }
          if (url.pathname.endsWith("/files/fil_1/confirm")) {
            calls.push("confirm");
            return json(200, { file: { id: "fil_1" } });
          }
          if (url.pathname.endsWith("/documents") && m === "POST") {
            calls.push("attach");
            attached = JSON.parse(String(init?.body));
            return json(201, { id: "gdc_1" });
          }
          return url.pathname.endsWith("/documents") ? json(200, { items: [] }) : undefined;
        },
      ],
    });
    renderApp(<GuestDocuments guestId="gst_1" />);
    expect(await screen.findByText("No documents on file.")).toBeInTheDocument();
    const file = new File(["%PDF-1.4"], "passport.pdf", { type: "application/pdf" });
    await userEvent.setup().upload(screen.getByLabelText("Choose a file to attach"), file);
    expect(await screen.findByText("passport.pdf attached")).toBeInTheDocument();
    expect(calls).toEqual(["presign", "put", "confirm", "attach"]);
    expect(attached).toEqual({ fileId: "fil_1", kind: "id_document", label: null });
  });
});
