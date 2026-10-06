import { ROLE_LABEL } from "./screens/users";
import { NAV_GROUPS, NAV_META, navKeyOf, visibleNav } from "./nav";
import type { Ctx } from "./context";
import { C } from "@/styles/colors";

/** The application chrome: sidebar, top bar, bottom navigation, notification panel (design: vm.build chrome). */
export function shellVM(c: Ctx, scr: string, pageTitle: string) {
  const { i, me, ui, set } = c;
  const mob = c.mobile;
  const ar = i.lang === "ar";
  const nav = visibleNav(me);
  const navKey = navKeyOf(scr);
  const navLabel = (k: string): string => {
    const o = i.t[`nav_${k}_${me.role}`];
    return o ?? i.L(NAV_META[k]?.l);
  };
  const item = (k: string) => {
    const on = k === navKey;
    return {
      k,
      label: navLabel(k),
      go: () => c.go(k),
      bg: on ? C.chrome.hover : "transparent",
      fg: on ? C.surface.white : C.chrome.text,
      bar: on ? C.chrome.accent : "transparent",
      hasCount: false,
      count: 0,
      countBg: C.chrome.lineAlt,
      mfg: on ? C.brand.primary : C.text.secondary,
      mbar: on ? C.brand.primary : "transparent",
    };
  };
  const scopeText =
    me.scope === "all"
      ? i.S("allProjects")
      : String(
          (c.data.projects ?? []).length
            ? (c.data.projects ?? [])
                .filter((p) => (me.scope as string[]).includes(p.id))
                .map((p) => i.L(p.name))
                .join(ar ? "، " : ", ")
            : "",
        ) || i.S("scope");
  const roleLabel = i.L(ROLE_LABEL[me.role]);
  const notifs = c.data.notifications?.items ?? [];
  return {
    t: i.t,
    dir: i.dir,
    lang: i.lang,
    mobile: mob,
    notMobile: !mob,
    arr: ar ? "←" : "→",
    arrBack: ar ? "→" : "←",
    pad: mob ? "16px 16px 28px" : "24px 28px 40px",
    hpad: mob ? "16px" : "24px",
    mainCols: ui.w < 1080 ? "minmax(0,1fr)" : "minmax(0,1.85fr) minmax(320px,1fr)",
    sideW: ui.w < 1180 ? "216px" : "244px",
    navGroups: ["ops", "people", "insight", "admin", "restricted"]
      .map((g) => ({
        label: i.L(NAV_GROUPS[g]),
        restricted: g === "restricted",
        items: nav.filter((k) => NAV_META[k]?.g === g).map(item),
      }))
      .filter((g) => g.items.length),
    meName: i.L(me.name),
    meIni: i.L(me.ini),
    meTitle: i.L(me.title),
    meRole: roleLabel,
    meScope: `${i.S("scope")}: ${scopeText}`,
    showSide: !mob,
    showBottom: mob && !["inspect", "report"].includes(scr),
    showTop: !(mob && scr === "inspect"),
    bottomNav: nav.slice(0, nav.length > 5 ? 4 : 5).map(item),
    hasMore: nav.length > 5,
    moreItems: nav.slice(4).map(item),
    moreOpen: ui.more,
    openMore: () => set({ more: !ui.more }),
    closeMore: () => set({ more: false }),
    moreFg: ui.more ? C.brand.primary : C.text.secondary,
    pageTitle,
    pageSub: `${roleLabel} · ${scopeText}`,
    // search arrives with the server-side search phase; the entry point stays hidden until then
    canSearch: false,
    openSearch: () => undefined,
    closeSearch: () => set({ search: false }),
    searchOpen: false,
    unread: c.data.notifications?.unread ?? 0,
    hasUnread: (c.data.notifications?.unread ?? 0) > 0,
    toggleNotif: () => set({ notif: !ui.notif, search: false }),
    notifOpen: ui.notif,
    closeNotif: () => set({ notif: false }),
    notifW: mob ? "100%" : "400px",
    markAll: () => void c.actions.markAllNotificationsRead(),
    notifs: notifs.map((x) => ({
      t: x.title,
      sub: x.body,
      at: i.fd(x.createdAt, "dt"),
      unread: !x.read,
      bg: x.read ? C.surface.white : C.brand.washFaint,
      dot: x.read ? "transparent" : C.brand.primary,
      // opening a notification still goes through the normal screens, which the backend authorizes again
      go: () => {
        if (!x.read) void c.actions.markNotificationRead(x.id);
        const go = x.data?.go;
        if (go) c.go(go[0], go[1]);
        else set({ notif: false });
      },
    })),
    notifEmpty: notifs.length === 0,
    hasToast: !!ui.toast,
    toastMsg: ui.toast?.msg ?? "",
    toastHasAction: !!ui.toast?.action,
    toastAction: ui.toast?.action?.label ?? "",
    toastGo: () => {
      ui.toast?.action?.fn();
      set({ toast: null });
    },
    sheetOpen: ui.sheet,
    toggleSheet: () => set({ sheet: !ui.sheet }),
    closeSheet: () => set({ sheet: false }),
    offline: false,
  };
}
