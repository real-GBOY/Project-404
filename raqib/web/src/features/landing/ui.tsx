import { useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { C } from "@/styles/colors";
import { FONT } from "@/styles/typography";
import type { Row } from "./copy-types";

/** [text, background] for each meaning a status chip can have. */
const TONES: Record<string, readonly [string, string]> = {
  success: [C.status.success.fg, C.status.success.bg],
  warning: [C.status.warning.fg, C.status.warning.bg],
  danger: [C.status.danger.fg, C.status.danger.bg],
  info: [C.status.info.fg, C.status.info.bg],
  review: [C.status.review.fg, C.status.review.bg],
  neutral: [C.text.secondary, C.surface.sunken],
};
export const tone = (k: string | undefined): readonly [string, string] =>
  TONES[k ?? ""] ?? TONES.neutral!;

/** Read a row of copy by position; a missing cell reads as empty rather than throwing. */
export const cell = (row: Row, i: number): string => row[i] ?? "";

/** The striped placeholder used where a photo or video sits. */
export const HATCH = (size = 7): string =>
  `repeating-linear-gradient(135deg, ${C.surface.sunkenAlt} 0 ${size}px, ${C.surface.sunkenDeep} ${size}px ${size * 2}px)`;

export const SHADOW = `0 1px 2px ${C.shadow.hairline}, 0 18px 40px -12px ${C.shadow.panel}`;

export const MONO: CSSProperties = { fontFamily: FONT.mono };

/** Responsive sizes, chosen by the same three breakpoints as the approved design. */
export interface Layout {
  mob: boolean;
  tab: boolean;
  navCollapse: boolean;
  hpad: number;
  heroPad: number;
  secPad: number;
  h1: number;
  h2: number;
  h3big: number;
  heroCols: string;
  probCols: string;
  featCols: string;
  roleCols: string;
  capCols: string;
  tourCols: string;
}

const QUERIES = ["(max-width: 759px)", "(max-width: 1039px)", "(max-width: 1079px)"] as const;

function subscribe(onChange: () => void): () => void {
  const mqs = QUERIES.map((q) => window.matchMedia(q));
  mqs.forEach((m) => m.addEventListener("change", onChange));
  return () => mqs.forEach((m) => m.removeEventListener("change", onChange));
}
const snapshot = (): string =>
  QUERIES.map((q) => (window.matchMedia(q).matches ? "1" : "0")).join("");

export function useLayout(): Layout {
  const bits = useSyncExternalStore(subscribe, snapshot, () => "000");
  const mob = bits[0] === "1";
  const tab = bits[1] === "1";
  const one = "minmax(0,1fr)";
  return {
    mob,
    tab,
    navCollapse: bits[2] === "1",
    hpad: mob ? 18 : 32,
    heroPad: mob ? 36 : 72,
    secPad: mob ? 56 : 96,
    h1: mob ? 34 : tab ? 44 : 54,
    h2: mob ? 26 : 36,
    h3big: mob ? 24 : 30,
    heroCols: tab ? one : "minmax(0,1fr) minmax(0,1.02fr)",
    probCols: tab ? one : "minmax(0,.9fr) minmax(0,1.1fr)",
    featCols: tab ? one : "minmax(0,.85fr) minmax(0,1.15fr)",
    roleCols: mob ? one : "260px minmax(0,1fr) 160px",
    capCols: mob ? one : "repeat(2,minmax(0,1fr))",
    tourCols: tab ? one : "minmax(0,.55fr) minmax(0,1.45fr)",
  };
}

/** A full-width band of the page with the content held to the design's 1240px column. */
export function Band({
  id,
  bg,
  color,
  top = true,
  L,
  gap,
  children,
  inner,
}: {
  id?: string;
  bg?: string;
  color?: string;
  top?: boolean;
  L: Layout;
  gap?: number;
  children: ReactNode;
  inner?: CSSProperties;
}) {
  return (
    <section
      id={id}
      style={{
        borderTop: top ? `1px solid ${C.border.hairline}` : undefined,
        background: bg,
        color,
        scrollMarginTop: 64,
      }}
    >
      <div
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: `${L.secPad}px ${L.hpad}px`,
          display: gap ? "flex" : undefined,
          flexDirection: gap ? "column" : undefined,
          gap,
          ...inner,
        }}
      >
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({
  children,
  color = C.brand.primary,
}: {
  children: ReactNode;
  color?: string;
}) {
  return (
    <div style={{ fontSize: 12, letterSpacing: ".08em", color, fontWeight: 500 }}>{children}</div>
  );
}

export function H2({ L, children }: { L: Layout; children: ReactNode }) {
  return (
    <h2
      style={{ margin: 0, fontSize: L.h2, lineHeight: 1.2, fontWeight: 700, textWrap: "balance" }}
    >
      {children}
    </h2>
  );
}

/** A heading block: eyebrow, title and an optional paragraph. */
export function Heading({
  L,
  eyebrow,
  title,
  body,
  eyebrowColor,
  bodyColor = C.text.body,
  max = 760,
}: {
  L: Layout;
  eyebrow: string;
  title: string;
  body?: string;
  eyebrowColor?: string;
  bodyColor?: string;
  max?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: max }}>
      <Eyebrow color={eyebrowColor}>{eyebrow}</Eyebrow>
      <H2 L={L}>{title}</H2>
      {body ? (
        <p style={{ margin: 0, fontSize: 16, color: bodyColor, textWrap: "pretty" }}>{body}</p>
      ) : null}
    </div>
  );
}

/** A status chip. */
export function Chip({ text, k }: { text: string; k: string }) {
  const [fg, bg] = tone(k);
  return (
    <span
      style={{
        height: 22,
        padding: "0 8px",
        borderRadius: 3,
        fontSize: 11.5,
        fontWeight: 500,
        color: fg,
        background: bg,
        display: "inline-flex",
        alignItems: "center",
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </span>
  );
}

/** Left-to-right text inside a right-to-left page: references, codes, times. */
export function Ltr({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span dir="ltr" style={{ ...MONO, ...style }}>
      {children}
    </span>
  );
}

/** The three answer buttons of an inspection item. `pick` highlights one. */
export function AnswerRow({
  labels,
  pick,
  height,
  size,
}: {
  labels: readonly [string, string, string];
  pick: 0 | 1 | null;
  height: number;
  size: number;
}) {
  const palette = [
    { bd: C.status.success.fg, bg: C.status.success.bg, fg: C.status.success.fg },
    { bd: C.status.danger.fg, bg: C.status.danger.bg, fg: C.status.danger.fg },
  ] as const;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 5 }}>
      {labels.map((label, i) => {
        const p = pick === i ? palette[i as 0 | 1] : null;
        return (
          <span
            key={label}
            style={{
              height,
              border: `${p ? 1.5 : 1}px solid ${p ? p.bd : C.border.input}`,
              background: p ? p.bg : C.surface.white,
              borderRadius: 4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: size,
              color: p ? p.fg : C.text.body,
              fontWeight: p ? 600 : 400,
            }}
          >
            {label}
          </span>
        );
      })}
    </div>
  );
}

/** A dash-led list of points. */
export function Points({ items }: { items: readonly string[] }) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 14, color: C.text.body }}
    >
      {items.map((x) => (
        <div key={x} style={{ display: "flex", gap: 10 }}>
          <span style={{ color: C.brand.primary, fontWeight: 700 }}>—</span>
          <span>{x}</span>
        </div>
      ))}
    </div>
  );
}
