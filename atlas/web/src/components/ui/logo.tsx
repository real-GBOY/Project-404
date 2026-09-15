import { cn } from "@/lib/cn";
import { TOKEN_COLORS } from "@/styles/colors";

export interface LogoMarkProps {
  /** pixel size of the (square) mark */
  size?: number;
  /** "ink" = graphite mark for light surfaces (default); "paper" = light mark for dark surfaces */
  tone?: "ink" | "paper";
  /** the small ochre datum cell — the one addressable unit. Dropped below 24px and in monochrome contexts. */
  datum?: boolean;
  className?: string;
}

const MARK_FILL: Record<NonNullable<LogoMarkProps["tone"]>, string> = {
  ink: TOKEN_COLORS.text.foreground,
  paper: TOKEN_COLORS.surface.surfaceSubtle,
};

/**
 * The Atlas mark: a plate that divides into quadrants, a quadrant that divides
 * again, and one small cell — the datum — that holds the ochre accent. Encodes
 * the product's own recursion (portfolio → project → building → floor → unit).
 * See `Atlas RE OS Identity.dc.html` §02–03.
 */
export function LogoMark({ size = 24, tone = "ink", datum = true, className }: LogoMarkProps) {
  const fill = MARK_FILL[tone];
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("block flex-none", className)}
      aria-hidden="true"
    >
      <rect x="0" y="0" width="30" height="30" fill={fill} />
      <rect x="34" y="34" width="30" height="30" fill={fill} />
      <rect x="50" y="0" width="14" height="14" fill={fill} />
      <rect x="34" y="16" width="14" height="14" fill={fill} />
      <rect x="16" y="34" width="14" height="14" fill={fill} />
      <rect x="0" y="50" width="14" height="14" fill={fill} />
      {datum && <rect x="4" y="38" width="6" height="6" fill={TOKEN_COLORS.brand.primary} />}
    </svg>
  );
}

export interface LogoProps {
  /** "horizontal" = mark + ATLAS + RE OS badge in a row (default); "stacked" = mark-less compact wordmark over the badge */
  layout?: "horizontal" | "stacked";
  markSize?: number;
  tone?: "ink" | "paper";
  /** show the bordered "RE OS" badge next to the wordmark */
  showBadge?: boolean;
  className?: string;
}

/** Primary lockup: mark + wordmark (+ RE OS badge). See identity §02 "Logo system". */
export function Logo({ layout = "horizontal", markSize = 24, tone = "ink", showBadge = true, className }: LogoProps) {
  const textTone = tone === "paper" ? "text-surface-subtle" : "text-foreground";

  if (layout === "stacked") {
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        <span className={cn("font-sans text-[20px] font-bold leading-none tracking-[-0.03em]", textTone)}>
          ATLAS
        </span>
        {showBadge && (
          <span className="font-mono text-[8px] tracking-[0.24em] text-secondary">RE OS</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <LogoMark size={markSize} tone={tone} />
      <div className="flex items-end gap-2">
        <span className={cn("font-sans text-[20px] font-bold leading-none tracking-[-0.03em]", textTone)}>
          ATLAS
        </span>
        {showBadge && (
          <span
            className={cn(
              "mb-[1px] whitespace-nowrap border px-1.5 py-0.5 font-mono text-[9px] tracking-[0.2em]",
              tone === "paper" ? "border-sidebar-foreground text-surface-subtle" : "border-foreground text-foreground",
            )}
          >
            RE OS
          </span>
        )}
      </div>
    </div>
  );
}
