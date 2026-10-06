import { DEMO_NAMED_GUARDS, DEMO_PROJECTS, fillerGuards } from "./demo-data.js";
import type { DemoVisit } from "./demo-visits.js";

/** Below this many days the demo is just the hand-written scenarios (the test suites run with 14). */
export const HISTORY_MIN_DAYS = 31;

/** Small deterministic PRNG (mulberry32): the same history on every machine, every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FINDINGS: Record<string, string[]> = {
  q1: ["Visitor log had gaps for the afternoon shift.", "Visitor log not signed by the shift lead."],
  q2: ["Visitors admitted without a photo ID during the observation.", "ID check skipped at peak entry time."],
  q3: ["Vehicle search not recorded for two trucks.", "Search procedure not followed at the vehicle gate."],
  q4: ["Two guards without a visible ID badge."],
  q5: ["Two cameras offline at the time of the visit.", "One camera covering the fence is out of focus."],
  q6: ["Control room left unattended for several minutes."],
  q7: ["Recordings retained for fewer than 90 days."],
  q8: ["Patrol started 40 minutes late.", "One patrol round skipped on the previous night."],
  q9: ["Patrol checkpoints not scanned on the last round.", "One checkpoint tag was missing."],
  q10: ["Patrol log not signed by the supervisor this week."],
  q11: ["Fire extinguishers past their inspection date."],
  q12: ["Emergency exit partly blocked by stored material."],
  q13: ["Evacuation plan not posted on this floor."],
  q14: ["Post orders missing from the post."],
  q15: ["Handover log incomplete for the previous shift.", "Night-shift signature missing on two days."],
  q16: ["Incident register not updated after yesterday's event."],
  q17: ["Radio check not logged at the start of shift."],
};
const ITEM_KEYS = Object.keys(FINDINGS);

/**
 * A year of ordinary business, played through the real services like every other demo visit: roughly one inspection every
 * four days, rotating over the projects that have an inspector, each fully answered, submitted, reviewed and approved. Older
 * visits find more problems than recent ones, so the compliance trend on the overview visibly improves. Deterministic.
 */
export function historyVisits(days: number): DemoVisit[] {
  if (days < HISTORY_MIN_DAYS) return [];
  const rand = rng(2026);
  const inspectorOf: Record<string, string> = { p1: "insA", p2: "insB", p3: "insB" };
  const guardsOf = (project: string) => [...DEMO_NAMED_GUARDS, ...fillerGuards()].filter((g) => g.project === project).map((g) => g.employeeNo);
  const projects = DEMO_PROJECTS.filter((p) => inspectorOf[p.key]);
  const types: DemoVisit["type"][] = ["routine", "routine", "routine", "surprise", "follow", "night"];
  const out: DemoVisit[] = [];

  let n = 0;
  for (let ago = 4; ago <= days; ago += 4) {
    const p = projects[n % projects.length]!;
    const site = p.sites[Math.floor(rand() * p.sites.length)]!;
    const guards = guardsOf(p.key);
    const pick = (k: number) =>
      Array.from({ length: k }, (_, i) => guards[Math.floor(rand() * guards.length) + i] ?? guards[i]!).filter((g, i, a) => a.indexOf(g) === i);
    // older visits find more: ~2.8 problems a year ago, ~0.7 this month
    const mean = 0.6 + 2.2 * (ago / 365);
    const count = Math.min(5, Math.max(0, Math.round(mean + (rand() - 0.5) * 2.4)));
    const nonCompliant: Record<string, string> = {};
    while (Object.keys(nonCompliant).length < count) {
      const k = ITEM_KEYS[Math.floor(rand() * ITEM_KEYS.length)]!;
      const texts = FINDINGS[k]!;
      nonCompliant[k] = texts[Math.floor(rand() * texts.length)]!;
    }
    const type = types[Math.floor(rand() * types.length)]!;
    const shift = (["morning", "evening", "night"] as const)[Math.floor(rand() * 3)]!;
    out.push({
      key: `hist-${n}`,
      project: p.key,
      site: site.key,
      area: 0,
      inspector: inspectorOf[p.key]!,
      type,
      shift,
      day: -ago,
      time: shift === "morning" ? "09:30" : shift === "evening" ? "16:00" : "23:00",
      guards: pick(2),
      by: "qm",
      scheduledAgo: ago + 2,
      reason: "Scheduled inspection round",
      workflow: {
        nonCompliant,
        guardScores: Object.fromEntries(pick(2).map((g) => [g, Array.from({ length: 5 }, () => 3 + Math.round(rand() * 2))])),
        steps: [
          { action: "forward", by: "qe" },
          { action: "approve", by: "qm" },
        ],
      },
    });
    n += 1;
  }
  return out;
}
