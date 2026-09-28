import { cn } from "@/lib/cn";
import { statusLabel, toneFor, type Tone } from "@/lib/status";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  primary: "bg-primary-soft text-primary",
  neutral: "bg-neutral-soft text-neutral",
};

/** The design's status pill: 11px bold, soft tone background, 6px radius. */
export function StatusBadge({
  status,
  label,
  size = "md",
  className,
}: {
  status: string;
  label?: string;
  size?: "md" | "sm";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block w-fit font-bold whitespace-nowrap",
        size === "md"
          ? "rounded-badge px-2 py-[3px] text-micro"
          : "rounded-[5px] px-[7px] py-[3px] text-[10px]",
        TONE_CLASSES[toneFor(status)],
        className,
      )}
    >
      {label ?? statusLabel(status)}
    </span>
  );
}

export function ToneBadge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block w-fit rounded-badge px-2 py-[3px] text-micro font-bold",
        TONE_CLASSES[tone],
      )}
    >
      {children}
    </span>
  );
}
