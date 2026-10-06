import type { Project } from "@/api/types";
import { C } from "@/styles/colors";
import { scoreColor } from "../common";
import type { Ctx } from "../context";
import {
  PERIOD_DAYS,
  compliance,
  isOpen,
  overdueActions,
  weeklyAverages,
} from "./overview-figures";

/**
 * The numbers one project shows on the list and on its page, computed from what the person is allowed to read: approved reports
 * (score, trend), observations and corrective actions (open and late), visits (last inspection, completion). A part the role
 * cannot read is simply empty.
 */
export function projectFigures(c: Ctx, p: Project) {
  const { data, me } = c;
  const today = me.today;
  const high = data.settings?.scoring.high ?? 85;
  const mid = data.settings?.scoring.mid ?? 75;
  const reports = (data.reports?.items ?? []).filter((r) => r.projectId === p.id);
  const visits = (data.visits ?? []).filter((v) => v.project.id === p.id);
  const observations = (data.observations ?? []).filter((o) => o.project.id === p.id);
  const actions = (data.actions ?? []).filter((a) => a.project.id === p.id);
  const comp = compliance(reports, today, PERIOD_DAYS.quarter).byProject.get(p.id);
  const score = comp?.score ?? null;
  const delta = score != null && comp?.previous != null ? score - comp.previous : null;
  const issued = visits.filter((v) => v.status === "approved");
  const last =
    issued
      .map((v) => v.date)
      .sort()
      .pop() ?? null;
  const planned = visits.filter((v) => v.storedStatus !== "cancelled");
  return {
    score,
    scoreColor: scoreColor(score, high, mid),
    delta,
    reports,
    visits,
    observations,
    actions,
    openObservations: observations.filter(isOpen),
    openActions: actions.filter((a) => a.status !== "closed"),
    overdue: overdueActions(actions),
    last,
    done: issued.length,
    planned: planned.length,
    weeks: weeklyAverages(reports, today).map((w) => ({
      v: w.avg == null ? "" : String(w.avg),
      h: w.avg == null ? "4px" : `${Math.max(6, Math.round(w.avg * 0.9))}px`,
      c: w.avg == null ? C.surface.sunken : scoreColor(w.avg, high, mid),
      from: w.from,
    })),
    hasResults: reports.length > 0,
  };
}
