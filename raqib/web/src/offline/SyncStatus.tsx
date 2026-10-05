import { useEffect, useState } from "react";
import { createI18n } from "@/i18n/i18n";
import { useUi } from "@/state/ui-store";
import type { StoredOp } from "./outbox";
import { offline, useSyncState } from "./session";

/**
 * A small status pill, bottom corner of the workspace: offline, changes waiting, syncing, or "could not be saved" with
 * the list and a way to discard. It shows nothing when everything is in sync and online.
 */
export function SyncStatus() {
  const ui = useUi();
  const i = createI18n(ui.lang);
  const s = useSyncState();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState<StoredOp[]>([]);

  useEffect(() => {
    if (!open) return;
    void offline.list().then((all) => setFailed(all.filter((o) => o.failed)));
  }, [open, s.failed]);

  if (s.online && s.pending === 0 && s.failed === 0) return null;
  const tone =
    s.failed > 0
      ? { bg: "#FBE9E9", fg: "#A3262A", bd: "#E6B5B6" }
      : !s.online
        ? { bg: "#FAEFD8", fg: "#6B4600", bd: "#E8D2A0" }
        : { bg: "#E8F0FA", fg: "#1F4E8C", bd: "#B9CDE8" };
  const text =
    s.failed > 0
      ? i.S("off_failed", { n: s.failed })
      : !s.online
        ? `${i.S("off_offline")}${s.pending ? ` · ${i.S("off_waiting", { n: s.pending })}` : ""}`
        : s.syncing
          ? i.S("off_syncing")
          : i.S("off_waiting", { n: s.pending });

  return (
    <div
      style={{
        position: "fixed",
        insetInlineStart: 12,
        bottom: 12,
        zIndex: 30,
        maxWidth: "calc(100vw - 24px)",
        fontSize: 13,
      }}
    >
      <button
        type="button"
        onClick={() => s.failed > 0 && setOpen((o) => !o)}
        aria-live="polite"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 12px",
          borderRadius: 18,
          border: `1px solid ${tone.bd}`,
          background: tone.bg,
          color: tone.fg,
          cursor: s.failed > 0 ? "pointer" : "default",
          boxShadow: "0 1px 4px rgba(0,0,0,.12)",
        }}
      >
        <span aria-hidden style={{ width: 8, height: 8, borderRadius: 4, background: tone.fg }} />
        {text}
      </button>
      {open && s.failed > 0 ? (
        <div
          role="dialog"
          aria-label={i.S("off_failed", { n: s.failed })}
          style={{
            marginTop: 8,
            background: "#fff",
            border: "1px solid #E3E1DA",
            borderRadius: 6,
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
            width: 320,
            maxHeight: "50vh",
            overflowY: "auto",
          }}
        >
          {failed.map((o) => (
            <div
              key={o.seq}
              style={{ fontSize: 12.5, borderBottom: "1px solid #EEE", paddingBottom: 6 }}
            >
              <strong>{i.S(`off_k_${o.kind}`)}</strong>
              <div style={{ color: "#5C6168" }}>{o.failed?.message}</div>
              <button
                type="button"
                onClick={() =>
                  void offline
                    .discard(o.seq)
                    .then(() => setFailed((f) => f.filter((x) => x.seq !== o.seq)))
                }
                style={{
                  marginTop: 4,
                  height: 26,
                  padding: "0 10px",
                  border: "1px solid #D6D3CB",
                  borderRadius: 4,
                  background: "#fff",
                  cursor: "pointer",
                }}
              >
                {i.S("off_discard")}
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => void offline.discardFailed().then(() => setOpen(false))}
            style={{
              height: 32,
              border: 0,
              borderRadius: 4,
              background: "#A3262A",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            {i.S("off_discardAll")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
