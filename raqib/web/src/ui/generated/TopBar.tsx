/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";

export function TopBar({ vm }: { vm: VM }) {
  const {
    canSearch,
    hasUnread,
    hpad,
    mobile,
    notMobile,
    openSearch,
    pageSub,
    pageTitle,
    t,
    toggleNotif,
    unread,
  } = vm;
  return (
    <>
      <header
        style={{
          height: "58px",
          flexShrink: "0",
          background: C.surface.white,
          borderBottom: `1px solid ${C.border.hairline}`,
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: `0 ${hpad}`,
        }}
      >
        {mobile ? (
          <>
            <div
              style={{
                width: "30px",
                height: "30px",
                background: C.brand.primary,
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: C.surface.white,
                fontWeight: "700",
                fontSize: "15px",
                flexShrink: "0",
              }}
            >
              {t.logoMark}
            </div>
          </>
        ) : null}
        <div style={{ flex: "1", minWidth: "0", lineHeight: "1.3" }}>
          <div
            style={{
              fontSize: "15px",
              fontWeight: "600",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {pageTitle}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: C.text.muted,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {pageSub}
          </div>
        </div>
        {canSearch ? (
          <>
            {notMobile ? (
              <>
                <button
                  onClick={openSearch}
                  style={{
                    height: "36px",
                    width: "300px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "0 12px",
                    border: `1px solid ${C.border.input}`,
                    borderRadius: "4px",
                    background: C.surface.paper,
                    color: C.text.muted,
                    fontSize: "13px",
                    cursor: "pointer",
                    textAlign: "start",
                  }}
                >
                  <span
                    style={{
                      flex: "1",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {t.searchPh}
                  </span>
                  <span
                    dir="ltr"
                    style={{
                      fontFamily: FONT.mono,
                      fontSize: "11px",
                      border: `1px solid ${C.border.input}`,
                      borderRadius: "3px",
                      padding: "0 5px",
                      background: C.surface.white,
                    }}
                  >
                    Ctrl K
                  </span>
                </button>
              </>
            ) : null}
            {mobile ? (
              <>
                <button
                  onClick={openSearch}
                  style={{
                    height: "40px",
                    padding: "0 12px",
                    border: `1px solid ${C.border.input}`,
                    borderRadius: "4px",
                    background: C.surface.white,
                    fontSize: "13px",
                    cursor: "pointer",
                  }}
                >
                  {t.search}
                </button>
              </>
            ) : null}
          </>
        ) : null}
        <button
          onClick={toggleNotif}
          style={{
            position: "relative",
            height: "40px",
            padding: "0 12px",
            border: `1px solid ${C.border.input}`,
            borderRadius: "4px",
            background: C.surface.white,
            fontSize: "13px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>{t.notifications}</span>
          {hasUnread ? (
            <>
              <span
                style={{
                  minWidth: "20px",
                  height: "20px",
                  padding: "0 6px",
                  borderRadius: "10px",
                  background: C.brand.primary,
                  color: C.surface.white,
                  fontSize: "11px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {unread}
              </span>
            </>
          ) : null}
        </button>
      </header>
    </>
  );
}
