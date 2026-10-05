import { ModalFields } from "@/ui/generated/ModalFields";
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";

const field = {
  display: "flex",
  flexDirection: "column",
  gap: "5px",
  fontSize: "13px",
  fontWeight: 500,
} as const;
const area = (bd: string) =>
  ({
    border: `1px solid ${bd}`,
    borderRadius: "4px",
    padding: "8px 10px",
    fontSize: "14px",
    fontWeight: 400,
    resize: "vertical",
    fontFamily: "inherit",
  }) as const;

/** Dialog frame. The field blocks inside are generated from the design; reason/comment/footer are hand-written. */
export function Modal({ vm }: { vm: VM }) {
  const { md, t, dir } = vm;
  return (
    <>
      <div
        onClick={md.close}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, background: C.scrim.strong, zIndex: 60 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={md.title}
        dir={dir}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "calc(100% - 24px)",
          maxWidth: "520px",
          maxHeight: "calc(100% - 40px)",
          overflowY: "auto",
          background: C.surface.white,
          borderRadius: "6px",
          zIndex: 61,
          boxShadow: `0 20px 50px ${C.shadow.modal}`,
        }}
      >
        <div style={{ padding: "18px 20px 12px", borderBottom: `1px solid ${C.surface.track}` }}>
          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: 600 }}>{md.title}</h2>
          <div style={{ fontSize: "13px", color: C.text.secondary, marginTop: "2px" }}>
            {md.sub}
          </div>
        </div>
        <div
          style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: "12px" }}
        >
          <ModalFields vm={vm} />
          {md.isDiff ? (
            <div
              style={{
                maxHeight: "180px",
                overflowY: "auto",
                border: `1px solid ${C.surface.track}`,
                borderRadius: "4px",
              }}
            >
              {(md.diff as { t: string; c: string }[]).map((d, i) => (
                <div
                  key={i}
                  style={{
                    padding: "6px 10px",
                    borderBottom: `1px solid ${C.surface.subtle}`,
                    fontSize: "12.5px",
                    color: d.c,
                  }}
                >
                  {d.t}
                </div>
              ))}
            </div>
          ) : null}
          {md.needReason ? (
            <label style={field}>
              {md.reasonLabel}
              <textarea
                rows={3}
                value={md.reason.val}
                onChange={md.reason.on}
                placeholder={md.reasonPh}
                style={area(md.reason.bd)}
              />
            </label>
          ) : null}
          {md.optComment ? (
            <label style={field}>
              {t.m_comment}
              <textarea
                rows={2}
                value={md.comment.val}
                onChange={md.comment.on}
                style={area(C.border.input)}
              />
            </label>
          ) : null}
          {md.hasErr ? (
            <div style={{ fontSize: "12.5px", color: C.status.danger.fg }}>{md.errTxt}</div>
          ) : null}
          <div style={{ fontSize: "12px", color: C.text.muted }}>{md.audit}</div>
        </div>
        <div
          style={{
            padding: "12px 20px 16px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            borderTop: `1px solid ${C.surface.track}`,
          }}
        >
          <button
            onClick={md.close}
            style={{
              height: "40px",
              padding: "0 16px",
              border: `1px solid ${C.border.input}`,
              borderRadius: "4px",
              background: C.surface.white,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            {md.cancelLabel}
          </button>
          <button
            onClick={md.ok}
            disabled={md.busy}
            style={{
              height: "40px",
              padding: "0 18px",
              border: 0,
              borderRadius: "4px",
              background: md.okBg,
              color: C.surface.white,
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              opacity: md.busy ? 0.6 : 1,
            }}
          >
            {md.okLabel}
          </button>
        </div>
      </div>
    </>
  );
}
