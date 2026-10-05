import type { ProjectStatus, Template } from "@/api/types";
import type { I18n } from "@/i18n/i18n";
import { C } from "@/styles/colors";

/** Status tone → [foreground, background] (the approved design's palette). */
export const TONE: Record<string, [string, string]> = {
  ok: [C.status.success.fg, C.status.success.bg],
  warn: [C.status.warning.fg, C.status.warning.bg],
  bad: [C.status.danger.fg, C.status.danger.bg],
  info: [C.status.info.fg, C.status.info.bg],
  neu: [C.text.graphite, C.surface.sunken],
  rev: [C.status.review.fg, C.status.review.bg],
};

export const badge = (label: string, tone: string) => {
  const c = TONE[tone] ?? TONE.neu!;
  return { label, fg: c[0], bg: c[1] };
};

export { seg } from "@/styles/segmented";

/** Compliance score colour bands (thresholds come from the organization's settings). */
export const scoreColor = (p: number | null | undefined, high = 85, mid = 75): string =>
  p == null
    ? C.text.muted
    : p >= high
      ? C.status.success.fg
      : p >= mid
        ? C.status.warning.score
        : C.status.danger.fg;

export const pBadge = (i: I18n, st: ProjectStatus) =>
  badge(i.S(`ps_${st}`), st === "active" ? "ok" : st === "attention" ? "bad" : "neu");

/** UX-only template check (the backend decides). */
export const can = (permissions: Template, module: keyof Template, letter: string): boolean =>
  permissions[module]?.includes(letter) ?? false;
