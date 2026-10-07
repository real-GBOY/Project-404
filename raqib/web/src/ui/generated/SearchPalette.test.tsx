import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SearchPalette } from "./SearchPalette";

/** The search palette's keyboard promise ("↑↓ navigate, Enter open"): the arrows walk the results across groups, Enter opens the active one. */
const go = { a: vi.fn(), b: vi.fn(), c: vi.fn() };
const vm = (groups = true) => ({
  closeSearch: vi.fn(),
  confHit: false,
  dir: "ltr",
  notMobile: true,
  onQ: vi.fn(),
  q: "road",
  recent: [],
  searchGroups: groups
    ? [
        {
          label: "Projects",
          items: [
            { title: "Alpha", sub: "P-1", kind: "Project", go: go.a, bg: "white" },
            { title: "Beta", sub: "P-2", kind: "Project", go: go.b, bg: "white" },
          ],
        },
        {
          label: "Visits",
          items: [{ title: "Gamma", sub: "V-1", kind: "Visit", go: go.c, bg: "white" }],
        },
      ]
    : [],
  searchNone: !groups,
  searchRecent: false,
  searchRef: () => undefined,
  searchScope: "All projects",
  searchW: "640px",
  t: {
    searchPh: "Search",
    noSearchResults: "Nothing found",
    recentSearches: "Recent",
    confNotSearchable: "",
  },
});

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  Object.values(go).forEach((f) => f.mockClear());
});

const input = () => screen.getByRole("combobox");
const selected = () =>
  screen.getAllByRole("option").find((o) => o.getAttribute("aria-selected") === "true");

describe("search palette keyboard navigation", () => {
  it("starts on the first result and Enter opens it", () => {
    render(<SearchPalette vm={vm()} />);
    expect(selected()).toHaveTextContent("Alpha");
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(go.a).toHaveBeenCalledTimes(1);
  });

  it("ArrowDown and ArrowUp move through the results, across groups, and wrap around", () => {
    render(<SearchPalette vm={vm()} />);
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(selected()).toHaveTextContent("Beta");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(selected()).toHaveTextContent("Gamma"); // the next group
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(selected()).toHaveTextContent("Alpha"); // wrapped
    fireEvent.keyDown(input(), { key: "ArrowUp" });
    expect(selected()).toHaveTextContent("Gamma"); // wrapped backwards
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(go.c).toHaveBeenCalledTimes(1);
    expect(go.a).not.toHaveBeenCalled();
  });

  it("Home and End jump to the first and last result, and the input names the active row", () => {
    render(<SearchPalette vm={vm()} />);
    fireEvent.keyDown(input(), { key: "End" });
    expect(selected()).toHaveTextContent("Gamma");
    expect(input()).toHaveAttribute("aria-activedescendant", selected()!.id);
    fireEvent.keyDown(input(), { key: "Home" });
    expect(selected()).toHaveTextContent("Alpha");
  });

  it("the pointer moves the highlight too, and the arrows continue from there", () => {
    render(<SearchPalette vm={vm()} />);
    fireEvent.mouseMove(screen.getByRole("option", { name: /Beta/ }));
    expect(selected()).toHaveTextContent("Beta");
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    expect(selected()).toHaveTextContent("Gamma");
  });

  it("does nothing (and lets the keys through) when there are no results", () => {
    render(<SearchPalette vm={vm(false)} />);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    const down = fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });
    expect(down).toBe(true); // not prevented
    expect(Object.values(go).every((f) => !f.mock.calls.length)).toBe(true);
  });
});
