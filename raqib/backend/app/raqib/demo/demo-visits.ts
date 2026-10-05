/**
 * Demo visits (scheduling phase). Offsets are days from "today", so the demo is always current. Each is created
 * through the real VisitsService — as the person who would have scheduled it, on the business date it was
 * scheduled — so validation, references, history and notifications are the real ones. Later phases add the
 * visits that are in progress, under review, returned, rejected or approved, through their own workflows.
 */
export interface DemoVisit {
  key: string;
  project: string;
  site: string;
  /** Index of the site's area (design order) or free text. */
  area?: number;
  areaText?: string;
  inspector: string | null;
  type: "routine" | "surprise" | "follow" | "night";
  shift: "morning" | "evening" | "night";
  /** Days from today of the visit itself. */
  day: number;
  time: string;
  guards: string[]; // guard employee numbers
  /** Who scheduled it, and how many days before today they did. */
  by: string;
  scheduledAgo: number;
  reason: string;
  /** Optional follow-up actions applied afterwards. */
  reschedule?: { day: number; time: string; reason: string; by: string };
  cancel?: { reason: string; by: string };
  /** Start the inspection as the assigned inspector and fill in part of it, through the real services. */
  inspect?: { answers: Record<string, "c" | "n" | "x">; notes: Record<string, string>; evidenceFor: string[] };
}

export const DEMO_VISITS: DemoVisit[] = [
  {
    key: "v-main-gate", project: "p1", site: "s1", area: 0, inspector: "insA", type: "routine", shift: "morning", day: 0, time: "09:30", guards: ["G-10234", "G-10251"],
    by: "qm", scheduledAgo: 14, reason: "Monthly routine round of the main gate",
    inspect: {
      answers: { q1: "c", q2: "n", q3: "c", q4: "c" },
      notes: { q2: "Two visitors entered without showing ID during 20 minutes of observation." },
      evidenceFor: ["q2"],
    },
  },
  { key: "v-today-parking", project: "p1", site: "s4", area: 1, inspector: "insA", type: "surprise", shift: "evening", day: 0, time: "14:00", guards: ["G-10302"], by: "qe", scheduledAgo: 1, reason: "Surprise check of level P2" },
  { key: "v-tower-lobby", project: "p1", site: "s2", area: 0, inspector: "insA", type: "routine", shift: "morning", day: 1, time: "10:00", guards: ["G-10234"], by: "qm", scheduledAgo: 14, reason: "Monthly routine round", reschedule: { day: 2, time: "10:00", reason: "Conflicts with a Civil Defense visit to Tower A", by: "qm" } },
  { key: "v-control-night", project: "p1", site: "s5", area: 0, inspector: "insA", type: "night", shift: "night", day: 4, time: "23:00", guards: ["G-10288"], by: "qm", scheduledAgo: 7, reason: "Quarterly night inspection" },
  { key: "v-p2-checkpoint", project: "p2", site: "s7", area: 0, inspector: null, type: "follow", shift: "morning", day: 2, time: "08:30", guards: [], by: "qm", scheduledAgo: 4, reason: "Follow-up on checkpoint findings" },
  { key: "v-hospital-store", project: "p3", site: "s12", area: 0, inspector: "insB", type: "surprise", shift: "evening", day: 0, time: "17:00", guards: [], by: "qe", scheduledAgo: 4, reason: "Surprise check of the secure store" },
  { key: "v-p2-fence-overdue", project: "p2", site: "s8", area: 0, inspector: "insB", type: "routine", shift: "morning", day: -3, time: "09:00", guards: [], by: "qm", scheduledAgo: 16, reason: "Perimeter fence routine" },
  { key: "v-p2-reception-cancelled", project: "p2", site: "s9", area: 0, inspector: "insB", type: "routine", shift: "morning", day: -12, time: "09:00", guards: [], by: "qm", scheduledAgo: 20, reason: "Routine reception check", cancel: { reason: "Site closed for the National Day holiday", by: "qm" } },
];
