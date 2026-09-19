import { describe, expect, it, vi } from "vitest";
import type { IUserProvider, User } from "@core/contracts/index.js";
import { UNKNOWN_USER_NAME, UserDirectory } from "@core/identity/application/user-directory.js";

const user = (id: string, over: Partial<User> = {}): User => ({
  id,
  email: `${id}@example.test`,
  displayName: null,
  status: "active",
  emailVerified: true,
  locale: null,
  ...over,
});

/** An `IUserProvider` over a fixed set of users that records every lookup. */
function provider(users: User[]) {
  const byId = new Map(users.map((u) => [u.id, u]));
  const getUser = vi.fn(async (id: string) => byId.get(id) ?? null);
  const impl: IUserProvider = { getUser, userExists: async (id) => byId.has(id) };
  return { impl, getUser };
}

describe("UserDirectory — the generic id → display-name mechanism", () => {
  describe("userName", () => {
    it("prefers the display name, falls back to the email, then to the unknown placeholder", async () => {
      const { impl } = provider([user("usr_a", { displayName: "Nadia Named" }), user("usr_b")]);
      const dir = new UserDirectory(impl);
      expect(await dir.userName("usr_a")).toBe("Nadia Named");
      expect(await dir.userName("usr_b")).toBe("usr_b@example.test");
      expect(await dir.userName("usr_missing")).toBe(UNKNOWN_USER_NAME);
    });

    it("'no user' (null / undefined / empty) is null — distinct from an UNKNOWN user — and never hits the provider", async () => {
      const { impl, getUser } = provider([]);
      const dir = new UserDirectory(impl);
      expect(await dir.userName(null)).toBeNull();
      expect(await dir.userName(undefined)).toBeNull();
      expect(await dir.userName("")).toBeNull();
      expect(getUser).not.toHaveBeenCalled();
    });

    it("the placeholder is an em dash (a stable contract many read models render as-is)", () => {
      expect(UNKNOWN_USER_NAME).toBe("—");
    });

    it("characterisation: an EMPTY display name is returned as-is (?? only skips null/undefined), preserved from the original implementations", async () => {
      const { impl } = provider([user("usr_e", { displayName: "" })]);
      expect(await new UserDirectory(impl).userName("usr_e")).toBe("");
    });

    it("propagates a provider failure rather than inventing a name", async () => {
      const dir = new UserDirectory({ getUser: async () => Promise.reject(new Error("db down")), userExists: async () => false });
      await expect(dir.userName("usr_a")).rejects.toThrow("db down");
    });
  });

  describe("userNames (batch)", () => {
    it("maps every distinct id to its name, unknown ids to the placeholder", async () => {
      const { impl } = provider([user("usr_a", { displayName: "Nadia Named" }), user("usr_b")]);
      const names = await new UserDirectory(impl).userNames(["usr_a", "usr_b", "usr_nope"]);
      expect(Object.fromEntries(names)).toEqual({
        usr_a: "Nadia Named",
        usr_b: "usr_b@example.test",
        usr_nope: UNKNOWN_USER_NAME,
      });
    });

    it("ignores null / undefined / empty ids", async () => {
      const { impl, getUser } = provider([user("usr_a", { displayName: "A" })]);
      const names = await new UserDirectory(impl).userNames([null, undefined, "", "usr_a"]);
      expect([...names.keys()]).toEqual(["usr_a"]);
      expect(getUser).toHaveBeenCalledTimes(1);
    });

    it("de-duplicates: each DISTINCT id is looked up exactly once, however often it appears", async () => {
      const { impl, getUser } = provider([user("usr_a", { displayName: "A" }), user("usr_b", { displayName: "B" })]);
      const names = await new UserDirectory(impl).userNames(["usr_a", "usr_b", "usr_a", "usr_a", "usr_b"]);
      expect(getUser).toHaveBeenCalledTimes(2);
      expect(names.size).toBe(2);
    });

    it("keeps first-seen order", async () => {
      const { impl } = provider([user("usr_a", { displayName: "A" }), user("usr_b", { displayName: "B" })]);
      const names = await new UserDirectory(impl).userNames(["usr_b", "usr_a", "usr_b"]);
      expect([...names.keys()]).toEqual(["usr_b", "usr_a"]);
    });

    it("an empty batch is an empty map and makes no lookups", async () => {
      const { impl, getUser } = provider([]);
      expect((await new UserDirectory(impl).userNames([])).size).toBe(0);
      expect(getUser).not.toHaveBeenCalled();
    });

    it("resolves the distinct ids IN PARALLEL (there is no batch call on the contract, so this is the batching)", async () => {
      const started: string[] = [];
      let release!: () => void;
      const gate = new Promise<void>((r) => (release = r));
      const impl: IUserProvider = {
        userExists: async () => true,
        getUser: async (id) => {
          started.push(id);
          await gate; // nobody finishes until everybody has started
          return user(id, { displayName: id.toUpperCase() });
        },
      };
      const pending = new UserDirectory(impl).userNames(["a", "b", "c"]);
      await new Promise((r) => setTimeout(r, 10));
      expect(started).toEqual(["a", "b", "c"]); // all three in flight before any resolved
      release();
      expect(Object.fromEntries(await pending)).toEqual({ a: "A", b: "B", c: "C" });
    });

    it("a failing lookup rejects the whole batch (unchanged behaviour)", async () => {
      const impl: IUserProvider = {
        userExists: async () => true,
        getUser: async (id) => (id === "bad" ? Promise.reject(new Error("boom")) : user(id)),
      };
      await expect(new UserDirectory(impl).userNames(["ok", "bad"])).rejects.toThrow("boom");
    });
  });
});
