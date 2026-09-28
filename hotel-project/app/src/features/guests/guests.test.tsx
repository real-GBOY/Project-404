import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, renderApp, stubApi } from "@/test/render";
import { GuestsPage } from "./guests-page";
import { GuestProfilePage } from "./guest-profile-page";
import { Route, Routes } from "react-router-dom";

const GUEST = {
  id: "gst_1",
  fullName: "Nourhan Adel",
  phone: "+20 106 334 2290",
  email: "nourhan.adel@gmail.com",
  nationality: "EG",
  idDocumentType: "national_id",
  idDocumentNumber: "29507220104418",
  preferences: "Nile view.",
  vip: true,
  createdAt: "2026-09-01T10:00:00Z",
};

describe("Guests", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists guests with VIP badges and sends the search term to the API", async () => {
    const fetchMock = stubApi({
      permissions: ["read:guest", "create:guest"],
      routes: [
        (url) =>
          url.pathname.endsWith("/hotel/guests")
            ? json(200, { items: [GUEST], total: 1 })
            : undefined,
      ],
    });
    renderApp(<GuestsPage />);
    expect(await screen.findByText("Nourhan Adel")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();

    await userEvent.setup().type(screen.getByRole("searchbox", { name: "Search guests" }), "nour");
    await vi.waitFor(() =>
      expect(fetchMock.mock.calls.some(([u]) => String(u).includes("q=nour"))).toBe(true),
    );
  });

  it("refuses a new guest without any contact detail before calling the API", async () => {
    const fetchMock = stubApi({
      permissions: ["read:guest", "create:guest"],
      routes: [
        (url) =>
          url.pathname.endsWith("/hotel/guests") ? json(200, { items: [], total: 0 }) : undefined,
      ],
    });
    renderApp(<GuestsPage />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "+ New guest" }));
    await user.type(screen.getByLabelText("Full name"), "Walk-in Guest");
    await user.click(screen.getByRole("button", { name: "Save guest" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/phone number or an email/);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("masks the identity document on the profile", async () => {
    stubApi({
      permissions: ["read:guest"],
      routes: [
        (url) =>
          url.pathname.endsWith("/hotel/guests/gst_1")
            ? json(200, { ...GUEST, notes: [] })
            : undefined,
      ],
    });
    renderApp(
      <Routes>
        <Route path="/guests/:guestId" element={<GuestProfilePage />} />
      </Routes>,
      "/guests/gst_1",
    );
    expect(await screen.findByText(/National ID · •+4418/)).toBeInTheDocument();
    expect(screen.queryByText("29507220104418")).not.toBeInTheDocument();
    // read-only user: no edit, no note form
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Add a note")).not.toBeInTheDocument();
  });
});
