import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import type { Me } from "@/api/types";
import { DataError } from "@/components/DataError";
import { EvidenceViewer } from "@/components/EvidenceViewer";
import { Modal } from "@/components/Modal";
import { Toast } from "@/components/Toast";
import { AccountScreen } from "@/features/account/AccountScreen";
import { useSyncState } from "@/hooks/use-sync-state";
import { SyncStatus } from "@/components/SyncStatus";
import { useOfflineSync } from "@/hooks/use-offline-sync";
import { useActions } from "@/hooks/use-actions";
import { useDocumentLanguage } from "@/hooks/use-document-language";
import { useEvidenceObjectUrl } from "@/hooks/use-evidence-object-url";
import { useFrameWidth } from "@/hooks/use-frame-width";
import { useGo } from "@/app/use-go";
import { useI18n } from "@/hooks/use-i18n";
import { useOverlayDismissal } from "@/hooks/use-overlay-dismissal";
import { useScreenData } from "@/hooks/use-screen-data";
import { useScrollReset } from "@/hooks/use-scroll-reset";
import { buildVM } from "@/presenters/build";
import type { Ctx } from "@/presenters/context";
import { saveBlob } from "@/presenters/screens/reports";
import { viewerVM } from "@/presenters/viewer";
import { setUi, useUi } from "@/state/ui-store";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";
import { BottomNav } from "@/ui/generated/BottomNav";
import { LoadingSkeleton } from "@/ui/generated/LoadingSkeleton";
import { MoreSheet } from "@/ui/generated/MoreSheet";
import { NotificationPanel } from "@/ui/generated/NotificationPanel";
import { OfflineBanner } from "@/ui/generated/OfflineBanner";
import { SCREENS } from "@/ui/generated/screens";
import { SearchPalette } from "@/ui/generated/SearchPalette";
import { Sidebar } from "@/ui/generated/Sidebar";
import { TopBar } from "@/ui/generated/TopBar";
import { parseRoute } from "./routes";

/**
 * The signed-in application. It owns no business rules: it reads server state through TanStack Query, hands it with the UI
 * state to the presenters, and renders the approved screens from the view-model. Everything it does besides composing is in
 * a hook: data (`useScreenData`), commands (`useActions`), the offline queue (`useOfflineSync`), layout and overlay chores.
 */
export function Workspace({ me }: { me: Me }) {
  const ui = useUi();
  const { i } = useI18n();
  const loc = useLocation();
  const route = useMemo(() => parseRoute(loc.pathname), [loc.pathname]);
  const go = useGo();
  const actions = useActions();
  const sync = useSyncState();
  const { data, pending, denial, error, retry } = useScreenData(route, me, ui);

  useOfflineSync(me);
  useDocumentLanguage();
  useOverlayDismissal(ui.toast);
  useEvidenceObjectUrl(ui.viewer?.id, ui.viewerReq, actions);
  const frame = useFrameWidth();
  const scroller = useScrollReset(loc.pathname);

  const ctx: Ctx = {
    i,
    me,
    ui,
    set: setUi,
    route,
    data,
    go,
    toast: (msg, action) => setUi({ toast: { msg, action } }),
    openModal: (kind, d, mf) =>
      setUi({ modal: { kind, ...(d ?? {}) }, mf: mf ?? {}, mErr: null, busy: false }),
    actions,
    mobile: ui.w < 760,
  };

  const vm = buildVM(ctx, { pending, denial });
  vm.offline = !sync.online;
  vm.vw = viewerVM(ctx, (id, name) => void actions.evidenceBlob(id).then((b) => saveBlob(b, name)));
  const showError = !!error && !pending;

  return (
    <div
      dir={i.dir}
      lang={ui.lang}
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        fontFamily: FONT.sans,
        color: C.text.ink,
        fontSize: "14px",
        lineHeight: 1.5,
        WebkitFontSmoothing: "antialiased",
      }}
    >
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          justifyContent: "center",
          background: C.chrome.frame,
        }}
      >
        <div
          ref={frame}
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            display: "flex",
            overflow: "hidden",
            background: C.surface.canvas,
          }}
        >
          {vm.showSide ? <Sidebar vm={vm} /> : null}
          <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
            {vm.showTop ? <TopBar vm={vm} /> : null}
            {vm.offline ? <OfflineBanner vm={vm} /> : null}
            <main
              ref={scroller}
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
                position: "relative",
              }}
            >
              {showError ? (
                <DataError i={i} error={error} onRetry={retry} pad={vm.pad} />
              ) : vm.loading ? (
                <LoadingSkeleton vm={vm} />
              ) : vm.is.account ? (
                <AccountScreen me={me} pad={vm.pad} title={vm.pageTitle} />
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
          <SyncStatus />
        </div>
      </div>
    </div>
  );
}
