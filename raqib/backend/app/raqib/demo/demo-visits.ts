/**
 * Demo visits (scheduling phase). Offsets are days from "today", so the demo is always current. Each is created
 * through the real VisitsService — as the person who would have scheduled it, on the business date it was
 * scheduled — so validation, references, history and notifications are the real ones. Later phases add the
 * visits that are in progress, under review, returned, rejected or approved, through their own workflows.
 */
/** A full inspection played through the real services: answered, submitted, then decided by reviewers. */
export interface DemoWorkflow {
  /** Items answered non-compliant (all others compliant) with the inspector's note. */
  nonCompliant: Record<string, string>;
  /** Guard scores per criterion (default 4 each), keyed by employee number. */
  guardScores?: Record<string, number[]>;
  /** The decisions, in order. */
  steps: Array<{ action: "forward" | "return" | "reject" | "approve"; by: string; reason?: string; itemKeys?: string[] }>;
}

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
  workflow?: DemoWorkflow;
  inspect?: { answers: Record<string, "c" | "n" | "x">; notes: Record<string, string>; evidenceFor: string[] };
}

export const DEMO_VISITS: DemoVisit[] = [
  {
    key: "v-main-gate",
    project: "p1",
    site: "s1",
    area: 0,
    inspector: "insA",
    type: "routine",
    shift: "morning",
    day: 0,
    time: "09:30",
    guards: ["G-10234", "G-10251"],
    by: "qm",
    scheduledAgo: 14,
    reason: "Monthly routine round of the main gate",
    inspect: {
      answers: { q1: "c", q2: "n", q3: "c", q4: "c" },
      notes: { q2: "Two visitors entered without showing ID during 20 minutes of observation." },
      evidenceFor: ["q2"],
    },
  },
  {
    key: "v-today-parking",
    project: "p1",
    site: "s4",
    area: 1,
    inspector: "insA",
    type: "surprise",
    shift: "evening",
    day: 0,
    time: "14:00",
    guards: ["G-10302"],
    by: "qe",
    scheduledAgo: 1,
    reason: "Surprise check of level P2",
  },
  {
    key: "v-tower-lobby",
    project: "p1",
    site: "s2",
    area: 0,
    inspector: "insA",
    type: "routine",
    shift: "morning",
    day: 1,
    time: "10:00",
    guards: ["G-10234"],
    by: "qm",
    scheduledAgo: 14,
    reason: "Monthly routine round",
    reschedule: { day: 2, time: "10:00", reason: "Conflicts with a Civil Defense visit to Tower A", by: "qm" },
  },
  {
    key: "v-control-night",
    project: "p1",
    site: "s5",
    area: 0,
    inspector: "insA",
    type: "night",
    shift: "night",
    day: 4,
    time: "23:00",
    guards: ["G-10288"],
    by: "qm",
    scheduledAgo: 7,
    reason: "Quarterly night inspection",
  },
  {
    key: "v-p2-checkpoint",
    project: "p2",
    site: "s7",
    area: 0,
    inspector: null,
    type: "follow",
    shift: "morning",
    day: 2,
    time: "08:30",
    guards: [],
    by: "qm",
    scheduledAgo: 4,
    reason: "Follow-up on checkpoint findings",
  },
  {
    key: "v-hospital-store",
    project: "p3",
    site: "s12",
    area: 0,
    inspector: "insB",
    type: "surprise",
    shift: "evening",
    day: 0,
    time: "17:00",
    guards: [],
    by: "qe",
    scheduledAgo: 4,
    reason: "Surprise check of the secure store",
  },
  {
    key: "v-p2-fence-overdue",
    project: "p2",
    site: "s8",
    area: 0,
    inspector: "insB",
    type: "routine",
    shift: "morning",
    day: -3,
    time: "09:00",
    guards: [],
    by: "qm",
    scheduledAgo: 16,
    reason: "Perimeter fence routine",
  },
  {
    key: "v-p2-reception-cancelled",
    project: "p2",
    site: "s9",
    area: 0,
    inspector: "insB",
    type: "routine",
    shift: "morning",
    day: -12,
    time: "09:00",
    guards: [],
    by: "qm",
    scheduledAgo: 20,
    reason: "Routine reception check",
    cancel: { reason: "Site closed for the National Day holiday", by: "qm" },
  },
  // ── inspections that have been through (part of) the review workflow ──────────────────────
  {
    key: "v-returned",
    project: "p1",
    site: "s3",
    area: 1,
    inspector: "insA",
    type: "routine",
    shift: "morning",
    day: -3,
    time: "09:00",
    guards: ["G-10234", "G-10288"],
    by: "qm",
    scheduledAgo: 20,
    reason: "Routine round of Tower B",
    workflow: {
      nonCompliant: { q6: "Control room was unattended on arrival.", q11: "Two extinguishers expired (08/2026).", q15: "No evening-shift signature on 28/9." },
      steps: [
        {
          action: "return",
          by: "qe",
          reason:
            "Please complete items 6 and 11 before resubmitting: state how long the control room was unattended, and attach a photo of the inspection tag.",
          itemKeys: ["q6", "q11"],
        },
      ],
    },
  },
  {
    key: "v-pending-review",
    project: "p1",
    site: "s2",
    area: 2,
    inspector: "insA",
    type: "routine",
    shift: "evening",
    day: -5,
    time: "16:00",
    guards: ["G-10234", "G-10251"],
    by: "qm",
    scheduledAgo: 21,
    reason: "Floors 1-12 routine round",
    workflow: {
      nonCompliant: {
        q2: "Two visitors entered without showing ID during 20 minutes of observation.",
        q5: "Cameras C-P2-07 and C-P2-09 offline.",
        q13: "Evacuation plan not posted on floor 2.",
      },
      guardScores: { "G-10251": [3, 3, 2, 4, 3] },
      steps: [],
    },
  },
  {
    key: "v-pending-approval",
    project: "p2",
    site: "s6",
    area: 1,
    inspector: "insB",
    type: "follow",
    shift: "night",
    day: -6,
    time: "22:00",
    guards: ["G-20117", "G-20140"],
    by: "qm",
    scheduledAgo: 22,
    reason: "Follow-up on dock findings",
    workflow: {
      nonCompliant: {
        q3: "Vehicle search not carried out for two trucks.",
        q7: "Only 61 days of recordings retained.",
        q9: "3 of 14 checkpoints not scanned in the last patrol.",
        q11: "Two extinguishers expired (08/2026).",
        q12: "Wooden pallets partially block exit E-4.",
        q15: "No evening-shift signature on 28/9.",
      },
      guardScores: { "G-20140": [3, 2, 2, 3, 3] },
      steps: [{ action: "forward", by: "qe", reason: "Findings consistent with evidence. Recommend approval with corrective actions for items 11 and 12." }],
    },
  },
  {
    key: "v-pending-review-hospital",
    project: "p3",
    site: "s11",
    area: 0,
    inspector: "insB",
    type: "routine",
    shift: "morning",
    day: -4,
    time: "08:00",
    guards: ["G-30021"],
    by: "qe",
    scheduledAgo: 19,
    reason: "Ambulance bay routine round",
    workflow: { nonCompliant: { q13: "Evacuation plan not posted at the ambulance bay." }, steps: [] },
  },
  {
    key: "v-approved-1",
    project: "p2",
    site: "s7",
    area: 0,
    inspector: "insB",
    type: "routine",
    shift: "morning",
    day: -10,
    time: "09:00",
    guards: ["G-20117"],
    by: "qm",
    scheduledAgo: 25,
    reason: "Checkpoint routine round",
    workflow: {
      nonCompliant: {
        q3: "Vehicle search not carried out for one truck.",
        q8: "Patrol schedule missed twice.",
        q9: "Checkpoints skipped on yard patrols.",
        q15: "Shift handover log incomplete.",
      },
      steps: [
        { action: "forward", by: "qe" },
        { action: "approve", by: "qm" },
      ],
    },
  },
  {
    key: "v-approved-2",
    project: "p1",
    site: "s5",
    area: 0,
    inspector: "insA",
    type: "routine",
    shift: "morning",
    day: -12,
    time: "10:00",
    guards: ["G-10288"],
    by: "qm",
    scheduledAgo: 26,
    reason: "Control room routine round",
    workflow: {
      nonCompliant: { q5: "Two cameras offline on level P2.", q15: "Shift handover log incomplete." },
      steps: [
        { action: "forward", by: "qe" },
        { action: "approve", by: "qm" },
      ],
    },
  },
  {
    key: "v-approved-3",
    project: "p3",
    site: "s10",
    area: 0,
    inspector: "insB",
    type: "routine",
    shift: "morning",
    day: -13,
    time: "09:00",
    guards: ["G-30021"],
    by: "qm",
    scheduledAgo: 27,
    reason: "Reception routine round",
    workflow: {
      nonCompliant: { q13: "Evacuation plan not posted on floor 2." },
      steps: [
        { action: "forward", by: "qe" },
        { action: "approve", by: "qm" },
      ],
    },
  },
  {
    key: "v-rejected",
    project: "p2",
    site: "s6",
    area: 0,
    inspector: "insB",
    type: "night",
    shift: "night",
    day: -18,
    time: "23:00",
    guards: ["G-20140"],
    by: "qm",
    scheduledAgo: 30,
    reason: "Night inspection of storage",
    workflow: {
      nonCompliant: {
        q1: "Visitor log missing.",
        q2: "No ID checks.",
        q3: "No vehicle search.",
        q5: "Cameras offline.",
        q7: "Recordings not retained.",
        q8: "Patrols missed.",
        q9: "Checkpoints not scanned.",
        q11: "Extinguishers expired.",
        q12: "Exit blocked.",
        q15: "No handover.",
      },
      steps: [{ action: "reject", by: "qm", reason: "Evidence timestamps do not match the scheduled visit window. The visit is to be repeated in full." }],
    },
  },
];
