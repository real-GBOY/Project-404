import type { ReactNode } from "react";

const TONES = {
  warn: "bg-used-bg border-used-line text-used-ink",
  bad: "bg-bad-bg border-bad-line text-bad-ink",
  info: "bg-info-bg border-[#c7d5f3] text-[#1f3f8f]",
  ok: "bg-ok-bg border-[#b9dcc8] text-ok-fg",
} as const;

/** Persistent in-page banner for state that lives on the record (use a toast only for instant local actions). */
export function Notice({
  tone = "warn",
  children,
  role,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  role?: "alert" | "status";
}) {
  return (
    <div
      role={role ?? (tone === "bad" ? "alert" : "status")}
      className={`rounded-sm border px-4 py-3 text-sm leading-relaxed ${TONES[tone]}`}
    >
      {children}
    </div>
  );
}
