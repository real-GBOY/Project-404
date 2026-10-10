import type { ReactNode } from "react";
import type { StatusView, Tone } from "@/lib/status";

/** Static class strings so Tailwind can see every one. */
const TONE: Record<Tone, string> = {
  pending: "bg-pending-bg text-pending-fg",
  ok: "bg-ok-bg text-ok-fg",
  bad: "bg-bad-bg text-bad-fg",
  used: "bg-used-bg text-used-fg",
  todo: "bg-surface text-ink border border-ink",
  off: "bg-off-bg text-off-fg",
  info: "bg-info-bg text-info-fg",
};

/** A status pill: glyph + word, never color alone. */
export function Badge({
  status,
  size = "sm",
  children,
}: {
  status: StatusView;
  size?: "sm" | "md" | "lg";
  children?: ReactNode;
}) {
  const sizes = {
    sm: "text-xs px-2 py-0.5 gap-1",
    md: "text-[13px] px-2.5 py-1 gap-1.5",
    lg: "text-sm px-3 py-1.5 gap-1.5 font-semibold",
  };
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-semibold ${sizes[size]} ${TONE[status.tone]}`}
    >
      <span aria-hidden="true" className="font-mono text-[0.9em]">
        {status.glyph}
      </span>
      {children ?? status.label}
    </span>
  );
}
