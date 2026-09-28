import { describe, expect, it } from "vitest";
import { displayStatus } from "./room-status.js";

describe("displayStatus — derived, with fixed precedence", () => {
  it("a clean, in-service, empty room is available (inspected counts as clean)", () => {
    expect(displayStatus("clean", "in_service")).toBe("available");
    expect(displayStatus("inspected", "in_service")).toBe("available");
  });

  it("service blocks win over everything, including an in-house guest", () => {
    const occupied = { occupied: true, arrivingToday: false };
    expect(displayStatus("clean", "out_of_service", occupied)).toBe("out_of_service");
    expect(displayStatus("dirty", "maintenance", occupied)).toBe("maintenance");
  });

  it("a room under maintenance never reads as available just because it is empty and clean", () => {
    expect(displayStatus("clean", "maintenance")).toBe("maintenance");
  });

  it("occupancy beats housekeeping; housekeeping beats an arrival", () => {
    expect(displayStatus("dirty", "in_service", { occupied: true, arrivingToday: false })).toBe(
      "occupied",
    );
    expect(displayStatus("dirty", "in_service", { occupied: false, arrivingToday: true })).toBe(
      "dirty",
    );
    expect(displayStatus("cleaning", "in_service", { occupied: false, arrivingToday: true })).toBe(
      "cleaning",
    );
  });

  it("a ready room with an arrival due today is reserved", () => {
    expect(displayStatus("clean", "in_service", { occupied: false, arrivingToday: true })).toBe(
      "reserved",
    );
  });
});
