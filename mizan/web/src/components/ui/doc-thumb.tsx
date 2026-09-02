import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

const HATCH =
  "repeating-linear-gradient(135deg,#f6f6fa,#f6f6fa 8px,#f1f1f7 8px,#f1f1f7 16px)";

/**
 * Document card with the prototype's hatched "preview" panel. Used on the
 * Documents screen and the client / matter Documents tabs.
 */
export function DocThumb({
  name,
  meta,
  pill,
  actions,
  onClick,
  className,
}: {
  name: string;
  meta: ReactNode;
  pill?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      data-slot="doc-thumb"
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "overflow-hidden rounded-card border border-border bg-surface",
        onClick &&
          "cursor-pointer hover:border-border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className,
      )}
    >
      <div
        className="flex h-[140px] flex-col items-center justify-center gap-2 border-b border-divider-row-2"
        style={{ background: HATCH }}
      >
        <Icon name="picture_as_pdf" size={32} className="text-faint" />
        <span className="font-mono text-[10px] text-subtle">document preview</span>
      </div>
      <div className="p-3.5">
        <div className="line-clamp-2 min-h-[34px] text-[12.5px] font-bold leading-[1.35] text-foreground">
          {name}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-muted">
          {meta}
          {pill}
        </div>
        {actions && <div className="mt-[11px] flex items-center gap-[7px]">{actions}</div>}
      </div>
    </div>
  );
}
