import type { VM } from "@/ui/vm";

export function Toast({ vm }: { vm: VM }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "absolute", insetInline: "12px", bottom: vm.mobile ? "76px" : "20px", margin: "0 auto", maxWidth: "460px",
        background: "#191C1F", color: "#fff", borderRadius: "6px", padding: "12px 14px", fontSize: "13.5px", zIndex: 80,
        display: "flex", alignItems: "center", gap: "12px", boxShadow: "0 8px 24px rgba(0,0,0,.28)",
      }}
    >
      <span style={{ flex: 1 }}>{vm.toastMsg}</span>
      {vm.toastHasAction ? (
        <button
          onClick={vm.toastGo}
          style={{ border: 0, background: "transparent", color: "#7FD1B3", fontWeight: 600, cursor: "pointer", fontSize: "13.5px" }}
        >
          {vm.toastAction}
        </button>
      ) : null}
    </div>
  );
}
