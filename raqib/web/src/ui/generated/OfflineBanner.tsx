/* eslint-disable */
// Transpiled once from the approved Claude Design (Raqib.dc.html), now owned in this repo: colors come from @/styles/colors, fonts from @/styles/typography. Behavior belongs in presenters.
import type { VM } from "@/ui/vm";
import { C } from "@/styles/colors";

export function OfflineBanner({ vm }: { vm: VM }) {
  const { hpad, t } = vm;
  return (
    <>
      <div
        style={{
          flexShrink: "0",
          background: C.status.warning.bg,
          color: C.status.warning.strong,
          fontSize: "13px",
          padding: `8px ${hpad}`,
          borderBottom: `1px solid ${C.status.warning.border}`,
        }}
      >
        {t.offlineBanner}
      </div>
    </>
  );
}
