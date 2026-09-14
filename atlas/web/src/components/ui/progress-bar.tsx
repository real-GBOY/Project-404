import { cn } from "@/lib/cn";

export interface ProgressBarProps {
  /** 0–100 */
  value: number;
  height?: number;
  color?: string;
  trackClassName?: string;
  className?: string;
}

export function ProgressBar({ value, height = 6, color = "var(--color-primary)", trackClassName, className }: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className={cn("w-full overflow-hidden rounded-sm bg-surface-track", trackClassName, className)}
      style={{ height }}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className="h-full transition-[width]" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
