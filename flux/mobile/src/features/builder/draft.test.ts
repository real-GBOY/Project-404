import { describe, expect, it } from "vitest";
import { newItem, removeItemAt, type BuilderDraft } from "./draft";

const draft = (n: number, linked: Record<number, boolean>): BuilderDraft => ({
  name: "X",
  items: Array.from({ length: n }, (_, i) => newItem(`e${i}`, 50)),
  linked,
});

describe("removeItemAt", () => {
  it("drops the item and shifts later links down", () => {
    // 0-1 linked, 3-4 linked; remove item 2 → 0-1, 2-3
    const out = removeItemAt(draft(5, { 0: true, 3: true }), 2);
    expect(out.items!.map((i) => i.id)).toEqual(["e0", "e1", "e3", "e4"]);
    expect(out.linked).toEqual({ 0: true, 2: true });
  });

  it("drops links that touched the removed item", () => {
    // 1-2 linked; removing 2 leaves item 1 unlinked
    expect(removeItemAt(draft(4, { 1: true }), 2).linked).toEqual({});
    // removing the first of a pair removes the link too
    expect(removeItemAt(draft(4, { 1: true }), 1).linked).toEqual({});
  });
});

describe("newItem", () => {
  it("defaults to 3 sets", () => {
    expect(newItem("bench", 80, "6-8")).toEqual({
      id: "bench",
      sets: 3,
      reps: "6-8",
      targetKg: 80,
    });
  });
});
