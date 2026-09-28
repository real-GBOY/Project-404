import { describe, expect, it } from "vitest";
import { readHotelConfig } from "./config.js";

describe("readHotelConfig", () => {
  it("defaults the demo seed off", () => {
    expect(readHotelConfig({}).seedDemo).toBe(false);
  });

  it("turns the demo seed on only for the exact string true", () => {
    expect(readHotelConfig({ HOTEL_SEED_DEMO: "true" }).seedDemo).toBe(true);
    expect(readHotelConfig({ HOTEL_SEED_DEMO: "false" }).seedDemo).toBe(false);
  });

  it("fails fast on an unrecognised value instead of guessing", () => {
    expect(() => readHotelConfig({ HOTEL_SEED_DEMO: "yes" })).toThrow(/HOTEL_SEED_DEMO|seedDemo/);
  });
});
