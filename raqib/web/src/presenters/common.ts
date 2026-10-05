import type { ProjectStatus, Template } from "@/api/types";
import type { I18n } from "@/i18n/i18n";

/** Status tone → [foreground, background] (the approved design's palette). */
export const TONE: Record<string, [string, string]> = {
  ok: ["#1E6B45", "#E3F0E7"],
  warn: ["#8A5A00", "#FAEFD8"],
  bad: ["#A3262A", "#F7E2E1"],
  info: ["#1F4E8C", "#E2EBF6"],
  neu: ["#4A4F57", "#ECEAE5"],
  rev: ["#5B3E91", "#ECE6F5"],
};

export const badge = (label: string, tone: string) => {
  const c = TONE[tone] ?? TONE.neu!;
  return { label, fg: c[0], bg: c[1] };
};

/** Segmented-control button style. */
export function seg(cur: string, val: string, label: string, set: () => void, dark = false) {
  const on = cur === val;
  return {
    label,
    set,
    bg: on ? (dark ? "#E8EEEB" : "#191C1F") : dark ? "transparent" : "#fff",
    fg: on ? (dark ? "#0B0F0E" : "#fff") : dark ? "#9AA6A1" : "#3D4247",
  };
}

/** Compliance score colour bands (thresholds come from the organization's settings). */
export const scoreColor = (p: number | null | undefined, high = 85, mid = 75): string =>
  p == null ? "#8B9097" : p >= high ? "#1E6B45" : p >= mid ? "#B07400" : "#A3262A";

export const pBadge = (i: I18n, st: ProjectStatus) =>
  badge(i.S(`ps_${st}`), st === "active" ? "ok" : st === "attention" ? "bad" : "neu");

/** UX-only template check (the backend decides). */
export const can = (permissions: Template, module: keyof Template, letter: string): boolean =>
  permissions[module]?.includes(letter) ?? false;
