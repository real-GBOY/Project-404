import { cn } from "@/lib/cn";

/**
 * The Mizan mark — a balance (مِيزان). Institutional, built on permanence and
 * the certainty that nothing slips. From the Mizan Identity system:
 *
 * - The beam sits on the upper third; both pans hang at equal depth and radius.
 * - The brass pivot is the only filled element — the point everything balances on.
 * - Clearspace = the pan radius on all four sides.
 * - ≤ 28px the base plate + pivot drop away; ≤ 18px only the beam and pans remain.
 *
 * Strokes inherit `currentColor`; set the colour on the element (e.g.
 * `text-primary`, `text-primary-foreground`). The pivot is always brass.
 */
const BRASS = "#b99a5b";

export interface MizanMarkProps {
  /** rendered px size (square) */
  size?: number;
  className?: string;
  title?: string;
}

export function MizanMark({ size = 32, className, title = "Mizan" }: MizanMarkProps) {
  const sw = size <= 18 ? 9 : size <= 28 ? 7 : size <= 44 ? 5 : size <= 72 ? 4 : 3.4;
  const tiny = size <= 18;
  const small = size <= 28;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      role="img"
      aria-label={title}
      className={cn("flex-none", className)}
    >
      {/* beam */}
      <path d={tiny ? "M18 34 H 82" : "M16 32 H 84"} />
      {/* hangers */}
      <path d={tiny ? "M18 34 V 46" : small ? "M16 32 V 44" : "M16 32 V 42"} />
      <path d={tiny ? "M82 34 V 46" : small ? "M84 32 V 44" : "M84 32 V 42"} />
      {/* pans */}
      <circle cx={tiny ? 18 : 16} cy={tiny ? 58 : small ? 56 : 53} r={tiny ? 13 : small ? 12 : 11} />
      <circle cx={tiny ? 82 : 84} cy={tiny ? 58 : small ? 56 : 53} r={tiny ? 13 : small ? 12 : 11} />
      {/* central post */}
      {!tiny && <path d="M50 26 V 78" />}
      {/* base plate + brass pivot — full mark only */}
      {!small && (
        <>
          <path d="M36 81 H 64" />
          <circle cx="50" cy="22" r="4.5" fill={BRASS} stroke="none" />
        </>
      )}
    </svg>
  );
}

export interface MizanLogoProps {
  /** mark size in px */
  size?: number;
  /** wordmark font size in px (Spectral) */
  wordSize?: number;
  /** show the "The law firm system" strapline */
  strapline?: boolean;
  /** reverse for dark surfaces (paper ink + brass pivot) */
  reversed?: boolean;
  className?: string;
}

/** The horizontal primary lockup: mark + "Mizan" set in Spectral. */
export function MizanLogo({
  size = 34,
  wordSize = 20,
  strapline = false,
  reversed = false,
  className,
}: MizanLogoProps) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <MizanMark size={size} className={reversed ? "text-primary-foreground" : "text-foreground"} />
      <span className="flex min-w-0 flex-col">
        <span
          className={cn(
            "font-display font-normal leading-none tracking-[0.02em]",
            reversed ? "text-primary-foreground" : "text-foreground",
          )}
          style={{ fontSize: wordSize }}
        >
          Mizan
        </span>
        {strapline && (
          <span className="mt-1 text-[10px] font-medium uppercase leading-none tracking-[0.24em] text-link">
            The law firm system
          </span>
        )}
      </span>
    </span>
  );
}
