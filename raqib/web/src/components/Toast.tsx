import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";

export function Toast({ vm }: { vm: VM }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute",
        insetInline: "12px",
        bottom: vm.mobile ? "76px" : "20px",
        margin: "0 auto",
        maxWidth: "460px",
        background: C.text.ink,
        color: C.surface.white,
        borderRadius: "6px",
        padding: "12px 14px",
        fontSize: "13.5px",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        boxShadow: `0 8px 24px ${C.shadow.toast}`,
      }}
    >
      <span style={{ flex: 1 }}>{vm.toastMsg}</span>
      {vm.toastHasAction ? (
        <button
          onClick={vm.toastGo}
          style={{
            border: 0,
            background: "transparent",
            color: C.chrome.accentLight,
            fontWeight: 600,
            cursor: "pointer",
            fontSize: "13.5px",
          }}
        >
          {vm.toastAction}
        </button>
      ) : null}
    </div>
  );
}
