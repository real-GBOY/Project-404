import { useCallback, useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { Me } from "@/api/types";
import { createI18n } from "@/i18n/i18n";
import { buildVM } from "@/presenters/build";
import { saveBlob } from "@/presenters/screens/reports";
import { viewerVM } from "@/presenters/viewer";
import type { Ctx } from "@/presenters/context";
import { setUi, useUi } from "@/state/ui-store";
import { BottomNav } from "@/ui/generated/BottomNav";
import { LoadingSkeleton } from "@/ui/generated/LoadingSkeleton";
import { MoreSheet } from "@/ui/generated/MoreSheet";
import { NotificationPanel } from "@/ui/generated/NotificationPanel";
import { OfflineBanner } from "@/ui/generated/OfflineBanner";
import { SCREENS } from "@/ui/generated/screens";
import { SearchPalette } from "@/ui/generated/SearchPalette";
import { Sidebar } from "@/ui/generated/Sidebar";
import { TopBar } from "@/ui/generated/TopBar";
import { EvidenceViewer } from "@/ui/EvidenceViewer";
import { Modal } from "@/ui/Modal";
import { Toast } from "@/ui/Toast";
import { DataError } from "@/ui/DataError";
import { DemoBar } from "./DemoBar";
import { parseRoute, pathFor } from "./routes";
import { useActions } from "./use-actions";
import { useScreenData } from "./use-screen-data";

/**
 * The signed-in application. It owns no business rules: it reads server state through TanStack Query, hands
 * it with the UI state to the presenters, and renders the approved screens from the view-model.
 */
export function Workspace({ me }: { me: Me }) {
  const ui = useUi();
  const navigate = useNavigate();
  const loc = useLocation();
  const route = useMemo(() => parseRoute(loc.pathname), [loc.pathname]);
  const i = useMemo(() => createI18n(ui.lang), [ui.lang]);
  const actions = useActions();
  const { data, pending, denial, error, retry } = useScreenData(route, me, ui);
  const frame = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);

  // measure the app frame, not the window, so the layout reacts to the real available width
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.round(entries[0]!.contentRect.width);
      setUi((s) => (Math.abs(w - s.w) > 2 ? { w } : {}));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    document.documentElement.lang = ui.lang;
    document.documentElement.dir = i.dir;
  }, [ui.lang, i.dir]);

  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 0;
  }, [loc.pathname]);

  useEffect(() => {
    if (!ui.toast) return;
    const t = setTimeout(() => setUi({ toast: null }), 4200);
    return () => clearTimeout(t);
  }, [ui.toast]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUi({ search: false, notif: false, modal: null, more: false, busy: false });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = useCallback<Ctx["go"]>(
    (n, id, extra) => {
      setUi({ ...(extra ?? {}), search: false, notif: false, more: false, modal: null });
      navigate(pathFor(n, id));
    },
    [navigate],
  );

  const ctx: Ctx = {
    i,
    me,
    ui,
    set: setUi,
    route,
    data,
    go,
    toast: (msg, action) => setUi({ toast: { msg, action } }),
    openModal: (kind, d, mf) => setUi({ modal: { kind, ...(d ?? {}) }, mf: mf ?? {}, mErr: null, busy: false }),
    actions,
    mobile: ui.w < 760,
  };

  // The evidence viewer fetches the file only when the person asks (photos on open, video on request), through the
  // authorized endpoint with their credentials; the object URL lives only while the viewer is open.
  const viewerId = ui.viewer?.id;
  useEffect(() => {
    if (!viewerId || !ui.viewerReq) return;
    let url: string | null = null;
    let live = true;
    actions.evidenceBlob(viewerId).then(
      (b) => {
        if (!live) return;
        url = URL.createObjectURL(b);
        setUi({ viewerUrl: url });
      },
      () => live && setUi({ viewerErr: true }),
    );
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [viewerId, ui.viewerReq, actions]);

  const vm = buildVM(ctx, {
    pending,
    denial,
  });
  vm.vw = viewerVM(ctx, (id, name) => void actions.evidenceBlob(id).then((b) => saveBlob(b, name)));
  const showError = !!error && !pending;

  return (
    <div
      dir={i.dir}
      lang={ui.lang}
      style={{ height: "100vh", display: "flex", flexDirection: "column", fontFamily: "'IBM Plex Sans Arabic','IBM Plex Sans',system-ui,sans-serif", color: "#191C1F", fontSize: "14px", lineHeight: 1.5, WebkitFontSmoothing: "antialiased" }}
    >
      <DemoBar me={me} lang={ui.lang} />
      <div style={{ flex: 1, minHeight: 0, display: "flex", justifyContent: "center", background: "#2A302E" }}>
        <div ref={frame} style={{ position: "relative", width: "100%", height: "100%", display: "flex", overflow: "hidden", background: "#F5F4F0" }}>
          {vm.showSide ? <Sidebar vm={vm} /> : null}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {vm.showTop ? <TopBar vm={vm} /> : null}
            {vm.offline ? <OfflineBanner vm={vm} /> : null}
            <main ref={scroller} style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", position: "relative" }}>
              {showError ? (
                <DataError i={i} error={error} onRetry={retry} pad={vm.pad} />
              ) : vm.loading ? (
                <LoadingSkeleton vm={vm} />
              ) : (
                SCREENS.filter(([k]) => vm.is[k]).map(([k, Screen]) => <Screen key={k} vm={vm} />)
              )}
            </main>
            {vm.showBottom ? <BottomNav vm={vm} /> : null}
          </div>
          {vm.moreOpen ? <MoreSheet vm={vm} /> : null}
          {vm.searchOpen ? <SearchPalette vm={vm} /> : null}
          {vm.notifOpen ? <NotificationPanel vm={vm} /> : null}
          {vm.hasModal ? <Modal vm={vm} /> : null}
          {vm.vw ? <EvidenceViewer vm={vm} /> : null}
          {vm.hasToast ? <Toast vm={vm} /> : null}
        </div>
      </div>
    </div>
  );
}
