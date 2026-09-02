import { cn } from "@/lib/cn";

interface IconProps {
  /** Material Symbols Rounded ligature name, e.g. "gavel", "search". */
  name: string;
  className?: string;
  /** pixel size — sets font-size + optical size. Default 20. */
  size?: number;
  filled?: boolean;
  weight?: 300 | 400 | 500 | 600 | 700;
  "aria-hidden"?: boolean;
  "aria-label"?: string;
}

/** A single Material Symbols Rounded glyph. Decorative by default (aria-hidden). */
export function Icon({
  name,
  className,
  size = 20,
  filled = false,
  weight = 400,
  "aria-hidden": ariaHidden = true,
  "aria-label": ariaLabel,
}: IconProps) {
  return (
    <span
      className={cn("material-symbols-rounded select-none", className)}
      aria-hidden={ariaLabel ? undefined : ariaHidden}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      style={{
        fontSize: size,
        fontVariationSettings: `"FILL" ${filled ? 1 : 0}, "wght" ${weight}, "GRAD" 0, "opsz" ${size}`,
      }}
    >
      {name}
    </span>
  );
}
