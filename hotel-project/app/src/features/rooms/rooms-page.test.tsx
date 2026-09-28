import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { json, renderApp, stubApi } from "@/test/render";
import { RoomsPage } from "./rooms-page";

const TYPE = {
  id: "rmt_1",
  code: "DLX",
  name: "Grand Deluxe Room",
  description: null,
  capacity: 2,
  beds: "1 King bed",
  baseRate: 5400,
  amenities: [],
  sortOrder: 0,
  archivedAt: null,
  roomCount: 3,
};

const room = (number: string, displayStatus: string) => ({
  id: `rom_${number}`,
  number,
  floor: Number(number[0]),
  roomTypeId: "rmt_1",
  roomTypeName: "Grand Deluxe Room",
  roomTypeCode: "DLX",
  housekeepingStatus: "clean",
  serviceStatus: displayStatus === "maintenance" ? "maintenance" : "in_service",
  displayStatus,
  notes: null,
  archivedAt: null,
});

const routes = [
  (url: URL) =>
    url.pathname.endsWith("/hotel/rooms")
      ? json(200, {
          items: [room("301", "available"), room("302", "available"), room("303", "maintenance")],
        })
      : undefined,
  (url: URL) =>
    url.pathname.endsWith("/hotel/room-types") ? json(200, { items: [TYPE] }) : undefined,
];

describe("RoomsPage", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows derived statuses with counts per filter and narrows the board", async () => {
    stubApi({ permissions: ["read:room"], routes });
    renderApp(<RoomsPage />);
    const tabs = await screen.findByRole("tablist", { name: "Filter rooms by status" });
    expect(await within(tabs).findByRole("tab", { name: /All\s*3/ })).toBeInTheDocument();
    expect(within(tabs).getByRole("tab", { name: /Maintenance\s*1/ })).toBeInTheDocument();

    await userEvent.setup().click(within(tabs).getByRole("tab", { name: /Maintenance/ }));
    expect(screen.getByText("303")).toBeInTheDocument();
    expect(screen.queryByText("301")).not.toBeInTheDocument();
    expect(screen.getByText("5,400 EGP")).toBeInTheDocument();
  });

  it("hides management actions without manage:room", async () => {
    stubApi({ permissions: ["read:room"], routes });
    renderApp(<RoomsPage />);
    await screen.findByText("301");
    expect(screen.queryByRole("button", { name: "+ Add room" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit type/ })).not.toBeInTheDocument();
  });

  it("lets a manager open the add-room dialog", async () => {
    stubApi({ permissions: ["read:room", "manage:room"], routes });
    renderApp(<RoomsPage />);
    const add = await screen.findByRole("button", { name: "+ Add room" });
    await vi.waitFor(() => expect(add).toBeEnabled());
    await userEvent.setup().click(add);
    expect(screen.getByRole("dialog", { name: "Add room" })).toBeInTheDocument();
  });
});
