import type { ReactNode } from "react";
import { C } from "@/styles/colors";

const TONES = {
  success: { fg: C.brand.primary, bg: C.brand.tint },
  warning: { fg: C.status.warning.strong, bg: C.status.warning.bg },
  danger: { fg: C.status.danger.fg, bg: C.status.danger.bgTint },
} as const;

/** An inline message: success, warning or danger. Danger is announced as an alert, the others as polite status. */
export function Notice({
  tone,
  size = "sm",
  children,
}: {
  tone: keyof typeof TONES;
  size?: "sm" | "md";
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      style={{
        fontSize: size === "md" ? 13.5 : 13,
        color: t.fg,
        background: t.bg,
        borderRadius: 4,
        padding: size === "md" ? "10px 12px" : "8px 10px",
      }}
    >
      {children}
    </div>
  );
}
