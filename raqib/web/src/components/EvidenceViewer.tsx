import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { VideoPlayer } from "./VideoPlayer";

/** Protected evidence viewer: preview, metadata, signed-link playback request, controlled download. */
export function EvidenceViewer({ vm }: { vm: VM }) {
  const { vw, t, dir } = vm;
  const btn = {
    height: "38px",
    padding: "0 14px",
    border: `1px solid ${C.border.input}`,
    borderRadius: "4px",
    background: C.surface.white,
    fontSize: "13.5px",
    cursor: "pointer",
  } as const;
  return (
    <>
      <div
        onClick={vw.close}
        aria-hidden="true"
        style={{ position: "absolute", inset: 0, background: C.scrim.heavy, zIndex: 70 }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={vw.name}
        dir={dir}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%,-50%)",
          width: "calc(100% - 24px)",
          maxWidth: "760px",
          maxHeight: "calc(100% - 32px)",
          overflowY: "auto",
          background: C.surface.white,
          borderRadius: "6px",
          zIndex: 71,
          boxShadow: `0 20px 50px ${C.shadow.viewer}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "14px 18px",
            borderBottom: `1px solid ${C.surface.track}`,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontWeight: 600,
                fontSize: "15px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              dir="ltr"
            >
              {vw.name}
            </div>
            <div style={{ fontSize: "12px", color: C.text.secondary }}>{vw.kind}</div>
          </div>
          <button onClick={vw.close} style={btn}>
            {t.cancel}
          </button>
        </div>
        <div
          style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}
        >
          <div
            style={{
              minHeight: "220px",
              background: C.surface.sunken,
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundImage: vw.bgImg,
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              color: C.text.secondary,
              fontSize: "13px",
              textAlign: "center",
              padding: "12px",
            }}
          >
            {vw.isVideo ? (
              vw.videoUrl ? (
                <VideoPlayer src={vw.videoUrl} />
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  <span>{vw.protectedTxt}</span>
                  <button
                    onClick={vw.reqLink}
                    style={{
                      ...btn,
                      background: C.brand.primary,
                      color: C.surface.white,
                      border: 0,
                    }}
                  >
                    {t.requestPlayback}
                  </button>
                </div>
              )
            ) : null}
            {vw.isDoc ? <span>{t.docPreview}</span> : null}
            {vw.isPhotoNoUrl ? <span>{t.photoStored}</span> : null}
          </div>
          <dl
            style={{
              margin: 0,
              display: "grid",
              gridTemplateColumns: "140px minmax(0,1fr)",
              gap: "6px 12px",
              fontSize: "13px",
            }}
          >
            {(vw.meta as { k: string; v: string }[]).map((m, i) => (
              <div key={i} style={{ display: "contents" }}>
                <dt style={{ color: C.text.secondary }}>{m.k}</dt>
                <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{m.v}</dd>
              </div>
            ))}
          </dl>
          {vw.canDownload ? (
            <div>
              <button onClick={vw.download} style={btn}>
                {t.download}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
