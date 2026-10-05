import type { SearchHit } from "@/api/types";
import type { Ctx } from "./context";

const KINDS = ["project", "visit", "report", "observation", "action", "training", "guard", "user"] as const;
const CONF_WORDS = /confidential|سري|بلاغ|whistle|complaint/i;

/** The search palette (design: SearchPalette). Results come from the backend, already scope- and permission-filtered. */
export function searchVM(c: Ctx) {
  const { i, ui, set, me } = c;
  const q = ui.q.trim();
  const hits = c.data.searchHits ?? [];
  const close = () => set({ search: false });
  const open = (h: SearchHit) => {
    set((s) => ({ recentQ: [q, ...s.recentQ.filter((x) => x !== q)].slice(0, 5), search: false }));
    if (h.go[1]) c.go(h.go[0], h.go[1]);
    else c.go(h.go[0]);
  };
  const groups = KINDS.map((k) => ({
    label: i.S(`sk_${k}`),
    items: hits.filter((h) => h.kind === k).map((h) => ({ title: typeof h.title === "string" ? h.title : i.L(h.title), sub: [h.ref, h.sub].filter(Boolean).join(" · "), kind: i.S(`sk_${k}`), go: () => open(h), bg: "#fff" })),
  })).filter((g) => g.items.length);
  return {
    canSearch: true,
    openSearch: () => set({ search: true, q: "", notif: false }),
    searchOpen: ui.search,
    closeSearch: close,
    q: ui.q,
    onQ: (e: { target: { value: string } }) => set({ q: e.target.value }),
    searchRef: (el: HTMLInputElement | null) => el?.focus(),
    searchW: c.mobile ? "calc(100% - 24px)" : "640px",
    searchScope: i.S("searchScope", { s: me.scope === "all" ? i.S("allProjects") : String((me.scope as string[]).length) }),
    recent: ui.recentQ.map((r) => ({ label: r, set: () => set({ q: r }) })),
    searchRecent: q.length < 2 && ui.recentQ.length > 0,
    searchGroups: q.length >= 2 ? groups : [],
    searchNone: q.length >= 2 && groups.length === 0 && c.data.searchHits !== undefined,
    confHit: CONF_WORDS.test(q),
  };
}
