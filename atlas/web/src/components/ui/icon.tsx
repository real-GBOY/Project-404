import { cn } from "@/lib/cn";

/**
 * The design draws every chrome icon inline as a minimal 16×16 stroke SVG
 * (round caps, ~1.4px stroke) rather than using an icon font — sidebar nav
 * items themselves carry no icon at all (label + badge only). This registry
 * holds the exact paths pulled from the prototype (search/menu/bell/spark/
 * check/clock/alert/lead/unit/customer/project/doc/payment/step-*) plus a
 * small set of additional glyphs authored in the same visual language for
 * chrome the prototype needed but didn't draw explicitly (chevrons, close,
 * plus, view-toggle, download, filter, shield, gear, users, history, send).
 */
const PATHS: Record<string, string> = {
  search: "M10.3 10.3 13.4 13.4",
  menu: "M2.6 4.4h10.8 M2.6 8h10.8 M2.6 11.6h10.8",
  bell: "M4 6.8a4 4 0 0 1 8 0c0 2.4.7 3.6 1.2 4.2H2.8C3.3 10.4 4 9.2 4 6.8Z M6.6 13a1.6 1.6 0 0 0 2.8 0",
  spark: "M8 2.2 9.3 6 13 7.3 9.3 8.6 8 12.3 6.7 8.6 3 7.3 6.7 6Z",
  check: "M3.5 8.4l3 3 6-6.6",
  clock: "M8 2.6a5.4 5.4 0 1 0 0 10.8A5.4 5.4 0 0 0 8 2.6Z M8 5.3v3l2.2 1.3",
  alert: "M8 1.9 14.6 13.6H1.4Z M8 6v3.4 M8 11.6h.01",
  lead: "M8 2.6 13.4 8 8 13.4 2.6 8Z",
  unit: "M3.4 3.4h9.2v9.2H3.4Z M8 3.4v9.2 M3.4 8h9.2",
  customer: "M8 3.4a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8Z M3.6 13c0-2.2 2-3.4 4.4-3.4S12.4 10.8 12.4 13",
  project: "M3.4 13V3.4h5V13 M8.4 13V6.6h4.2V13 M5.4 6h1 M5.4 9h1 M10 9h1",
  doc: "M4.2 2.6h4.6l3 3v7.8H4.2Z M8.8 2.6v3h3",
  payment: "M2.4 4.6h11.2v6.8H2.4Z M2.4 7.2h11.2",
  "step-done": "M3.5 8.4l3 3 6-6.6",
  "step-current": "M8 5.4a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z",
  "step-pending": "M8 4.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8Z",
  "chevron-down": "M4 6.2 8 10.2 12 6.2",
  "chevron-up": "M4 9.8 8 5.8 12 9.8",
  "chevron-left": "M9.8 3.4 5.4 8l4.4 4.6",
  "chevron-right": "M6.2 3.4 10.6 8l-4.4 4.6",
  close: "M4 4l8 8 M12 4l-8 8",
  plus: "M8 3v10 M3 8h10",
  grid: "M2.6 2.6h4.4v4.4H2.6Z M9 2.6h4.4v4.4H9Z M2.6 9h4.4v4.4H2.6Z M9 9h4.4v4.4H9Z",
  rows: "M2.6 4.2h10.8 M2.6 8h10.8 M2.6 11.8h10.8",
  download: "M8 2.6v7.4 M4.8 7.2 8 10.4l3.2-3.2 M2.8 12.6h10.4",
  filter: "M2.8 3.6h10.4L9.2 8.6v3.4L6.8 13V8.6Z",
  shield: "M8 2.2 13 4v4.2c0 3.4-2.2 5.6-5 6.8-2.8-1.2-5-3.4-5-6.8V4Z",
  gear: "M8 5.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z M8 2.4v1.4 M8 12.2v1.4 M2.4 8h1.4 M12.2 8h1.4 M4.2 4.2l1 1 M10.8 10.8l1 1 M4.2 11.8l1-1 M10.8 5.2l1-1",
  users: "M6 3.4a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Z M1.8 12.8c0-2 1.9-3.2 4.2-3.2s4.2 1.2 4.2 3.2 M10.6 4a2 2 0 0 1 0 3.9 M12.4 8.8c1.6.3 2.8 1.3 2.8 3",
  history: "M8 2.6a5.4 5.4 0 1 0 4.2 8.8 M8 5.3v3l2.2 1.3 M11.6 2.6v2.6h-2.6",
  send: "M13.6 2.4 2.4 6.8l4.6 2.2 2.2 4.6Z M7 9l4.4-4.4",
  attach: "M11.4 6.2 6.6 11a2.2 2.2 0 1 1-3.1-3.1l5.6-5.6a3.1 3.1 0 1 1 4.4 4.4l-5.6 5.6a1.4 1.4 0 1 1-2-2l4.9-4.9",
  more: "M8 8h.01 M4 8h.01 M12 8h.01",
  "arrow-right": "M3.2 8h9.6 M9 4.4 12.6 8 9 11.6",
  trash: "M3.2 4.6h9.6 M6.2 4.6V3.2h3.6v1.4 M4.4 4.6l.6 8.2h6l.6-8.2",
  edit: "M11 2.4 13.6 5 5.4 13.2 2.6 13.4 2.8 10.6Z",
  building: "M4.2 13V3.6h7.6V13 M6.2 6h1 M9 6h1 M6.2 8.6h1 M9 8.6h1 M6.6 13v-2.6h2.8V13",
  home: "M2.6 8 8 3.2 13.4 8 M4.2 6.8V13h7.6V6.8",
};

export interface IconProps {
  /** Registered glyph name — see PATHS above. */
  name: keyof typeof PATHS | (string & {});
  className?: string;
  /** pixel size, sets both box and stroke-scaled viewBox. Default 16. */
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
  "aria-label"?: string;
}

/** A single inline stroke-icon glyph, matching the design's hand-drawn chrome icons. */
export function Icon({
  name,
  className,
  size = 16,
  strokeWidth = 1.4,
  "aria-hidden": ariaHidden = true,
  "aria-label": ariaLabel,
}: IconProps) {
  const d = PATHS[name];
  const isCircleSearch = name === "search";
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("flex-none select-none", className)}
      aria-hidden={ariaLabel ? undefined : ariaHidden}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
    >
      {isCircleSearch && <circle cx="7.2" cy="7.2" r="4.1" />}
      {d && <path d={d} />}
    </svg>
  );
}
