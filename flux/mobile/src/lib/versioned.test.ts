import { beforeEach, describe, expect, it } from "vitest";
import { memoryStorage } from "@/test/setup";
import { loadVersioned, migrate, saveVersioned } from "./versioned";

beforeEach(() => memoryStorage.clear());

describe("migrate", () => {
  const migrations = {
    0: (d: unknown) => ({ ...(d as object), a: 1 }),
    1: (d: unknown) => ({ ...(d as object), b: 2 }),
  };

  it("treats unwrapped data as version 0 and runs every step", () => {
    expect(migrate({ x: 0 }, 2, migrations)).toEqual({ x: 0, a: 1, b: 2 });
  });

  it("starts from the stored version", () => {
    expect(migrate({ v: 1, data: { x: 0 } }, 2, migrations)).toEqual({ x: 0, b: 2 });
    expect(migrate({ v: 2, data: { x: 0 } }, 2, migrations)).toEqual({ x: 0 });
  });

  it("skips versions without a migration", () => {
    expect(migrate({ x: 0 }, 3, {})).toEqual({ x: 0 });
  });
});

describe("loadVersioned / saveVersioned", () => {
  it("returns the fallback when nothing is stored", async () => {
    expect(await loadVersioned("k", { version: 1, fallback: ["f"] })).toEqual(["f"]);
  });

  it("round-trips through the envelope", async () => {
    await saveVersioned("k", 1, { n: 5 });
    expect(JSON.parse(memoryStorage.get("k")!)).toEqual({ v: 1, data: { n: 5 } });
    expect(await loadVersioned("k", { version: 1, fallback: null })).toEqual({ n: 5 });
  });

  it("upgrades an old envelope", async () => {
    await saveVersioned("k", 1, { n: 5 });
    const got = await loadVersioned<{ n: number; up?: boolean }>("k", {
      version: 2,
      fallback: { n: 0 },
      migrations: { 1: (d) => ({ ...(d as object), up: true }) },
    });
    expect(got).toEqual({ n: 5, up: true });
  });

  it("falls back on corrupt JSON", async () => {
    memoryStorage.set("k", "{not json");
    expect(await loadVersioned("k", { version: 1, fallback: "safe" })).toBe("safe");
  });
});
