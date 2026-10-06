import { ApiError } from "@/services/http";
import type { I18n } from "@/i18n/i18n";
import { C } from "@/styles/colors";

/**
 * A screen's data could not be loaded. Says what happened in the user's terms and offers the one useful
 * action (try again) — never a blank screen, never a raw stack.
 */
export function DataError({
  i,
  error,
  onRetry,
  pad,
}: {
  i: I18n;
  error: Error;
  onRetry: () => void;
  pad: string;
}) {
  const detail =
    error instanceof ApiError && error.status !== 0 ? error.message : i.S("loadErrBody");
  return (
    <div style={{ padding: pad, maxWidth: "560px", margin: "0 auto" }} role="alert">
      <div
        style={{
          background: C.surface.white,
          border: `1px solid ${C.border.hairline}`,
          borderRadius: "6px",
          padding: "20px 22px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>{i.S("loadErrTitle")}</h1>
        <div style={{ fontSize: "13.5px", color: C.text.secondary }}>{detail}</div>
        <div>
          <button
            onClick={onRetry}
            style={{
              height: "40px",
              padding: "0 16px",
              border: 0,
              borderRadius: "4px",
              background: C.brand.primary,
              color: C.surface.white,
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {i.S("reload")}
          </button>
        </div>
      </div>
    </div>
  );
}
