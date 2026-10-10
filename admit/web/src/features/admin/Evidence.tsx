import { useEffect, useState } from "react";
import { adminApi } from "@/api";
import type { PaymentDetail } from "@/api/types";

/**
 * The customer's proof, fetched with the reviewer's credentials (never a public link) and shown with zoom and rotate. Images only render
 * inline; a PDF opens in an embedded viewer. The object URL is revoked when the reviewer moves on.
 */
export function Evidence({
  submissionId,
  detail,
}: {
  submissionId: string;
  detail?: PaymentDetail;
}) {
  const [src, setSrc] = useState<{ url: string; type: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rot, setRot] = useState(0);

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    setSrc(null);
    setFailed(false);
    adminApi.payments.proof(submissionId).then(
      ({ blob, type }) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setSrc({ url, type });
      },
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [submissionId]);

  const btn = "h-8 rounded-xs border border-[#4a463f] bg-transparent px-2.5 text-xs text-paper";
  const isPdf = src?.type.includes("pdf");
  return (
    <div className="flex min-w-0 flex-col bg-night-2">
      <div className="flex flex-wrap items-center gap-1.5 border-b border-night-rule px-3 py-2 text-[13px] text-rule-strong">
        <span className="min-w-0 flex-[1_1_100%] truncate">
          {detail
            ? `Uploaded ${new Date(detail.submittedAt).toLocaleString("en-GB", { timeZone: "Africa/Cairo", hour12: false })}`
            : "Loading proof…"}
        </span>
        {!isPdf ? (
          <>
            <button
              aria-label="Zoom out"
              className={`${btn} w-8 px-0 text-base`}
              onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            >
              −
            </button>
            <span className="w-11 text-center font-mono text-xs">{Math.round(zoom * 100)}%</span>
            <button
              aria-label="Zoom in"
              className={`${btn} w-8 px-0 text-base`}
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            >
              +
            </button>
            <button className={btn} onClick={() => setRot((r) => (r + 90) % 360)}>
              Rotate
            </button>
            <button
              className={btn}
              onClick={() => {
                setZoom(1);
                setRot(0);
              }}
            >
              Fit
            </button>
          </>
        ) : null}
        {src ? (
          <a
            className={`${btn} inline-flex items-center text-paper no-underline hover:text-paper`}
            href={src.url}
            target="_blank"
            rel="noreferrer"
          >
            Original ↗
          </a>
        ) : null}
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-6">
        {failed ? (
          <p role="alert" className="max-w-xs text-center text-sm text-rule-strong">
            ✕ The proof could not be loaded. Reload, or ask an owner to check the file store.
          </p>
        ) : !src ? (
          <p role="status" aria-busy="true" className="text-sm text-faint">
            Loading proof…
          </p>
        ) : isPdf ? (
          <iframe
            title="Payment proof (PDF)"
            src={src.url}
            className="h-[600px] w-full border-0 bg-white"
          />
        ) : (
          <img
            src={src.url}
            alt="Customer's proof of payment"
            className="max-h-none w-[min(300px,100%)] bg-white shadow-[0_20px_40px_-20px_rgba(0,0,0,0.6)] transition-transform duration-150"
            style={{ transform: `scale(${zoom}) rotate(${rot}deg)` }}
          />
        )}
      </div>
    </div>
  );
}
