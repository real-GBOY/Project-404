/**
 * "Which available units are likely to sell soon" — a composite, fully
 * explainable score over data Atlas already has. No external market data, no
 * model speculation: every input is a real, currently-stored value.
 *
 *   score = 50% lead interest + 30% project sell-through + 20% inventory freshness
 *
 * Lead interest is matched by text, not by a direct foreign key: leads carry
 * a free-text `interestText` (e.g. "North Hills · 3-Bed") rather than a
 * populated `interestUnitId` (that column exists but nothing currently writes
 * to it), so the real, honest granularity this signal supports is
 * project + unit type, not one specific unit. Scoring every unit of that
 * project/type identically reflects that truthfully instead of pretending to
 * a precision the data doesn't have.
 */
import type { LeadStage, LeadStatus } from "@atlas/realestate/crm/domain/lead.domain.js";

export interface LikelyToSellUnitInput {
  id: string;
  code: string;
  projectId: string;
  projectName: string;
  unitType: string;
  floor: number;
  basePriceEgp: number;
  createdAt: Date;
}

export interface ProjectVelocityInput {
  id: string;
  name: string;
  sellThroughPct: number;
}

export interface LeadInterestInput {
  interestText: string | null;
  status: LeadStatus;
  stage: LeadStage;
}

export interface LikelyToSellResult {
  id: string;
  code: string;
  projectName: string;
  unitType: string;
  floor: number;
  basePriceEgp: number;
  /** 0-100, higher = more likely to sell soon. Not a probability or a guarantee. */
  score: number;
  factors: {
    activeLeadsInterested: number;
    bestLeadStage: LeadStage | null;
    projectSellThroughPct: number;
    daysInInventory: number;
  };
}

/** Funnel position → base points. Post-pipeline / dead stages score 0 — a
 *  lead that already converted or was lost is not live interest. */
const STAGE_RANK: Record<LeadStage, number> = {
  new: 1,
  qualified: 2,
  contacted: 3,
  viewing: 4,
  negotiation: 5,
  reserved: 0,
  contracted: 0,
  sold: 0,
  lost: 0,
};

function leadSignalFor(projectName: string, unitType: string, leads: LeadInterestInput[]): {
  score: number;
  count: number;
  bestStage: LeadStage | null;
} {
  const needle1 = projectName.toLowerCase();
  const needle2 = unitType.toLowerCase();
  let count = 0;
  let bestRank = 0;
  let bestStage: LeadStage | null = null;
  for (const lead of leads) {
    if (lead.status === "lost" || !lead.interestText) continue;
    const text = lead.interestText.toLowerCase();
    if (!text.includes(needle1) || !text.includes(needle2)) continue;
    const rank = STAGE_RANK[lead.stage];
    if (rank <= 0) continue;
    count++;
    if (rank > bestRank) {
      bestRank = rank;
      bestStage = lead.stage;
    }
  }
  // Base points from the best lead's funnel position, plus a small bonus per
  // additional interested lead, capped at 100.
  const score = count === 0 ? 0 : Math.min(100, bestRank * 20 + (count - 1) * 10);
  return { score, count, bestStage };
}

function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

export function rankUnitsLikelyToSell(
  units: LikelyToSellUnitInput[],
  projects: ProjectVelocityInput[],
  leads: LeadInterestInput[],
  now: Date,
  limit = 15,
): LikelyToSellResult[] {
  const projectsById = new Map(projects.map((p) => [p.id, p]));

  // Average inventory age per project, among the units being ranked — the
  // "moving vs. stale" baseline each unit is compared against.
  const ageByProject = new Map<string, number[]>();
  for (const u of units) {
    const days = daysBetween(u.createdAt, now);
    const list = ageByProject.get(u.projectId) ?? [];
    list.push(days);
    ageByProject.set(u.projectId, list);
  }
  const avgAgeByProject = new Map<string, number>(
    [...ageByProject.entries()].map(([projectId, days]) => [
      projectId,
      days.reduce((a, b) => a + b, 0) / days.length,
    ]),
  );

  const results = units.map((u): LikelyToSellResult => {
    const project = projectsById.get(u.projectId);
    const sellThroughPct = project ? Math.max(0, Math.min(100, project.sellThroughPct)) : 0;
    const daysInInventory = daysBetween(u.createdAt, now);
    const avgAge = avgAgeByProject.get(u.projectId) ?? daysInInventory;
    const ageRatio = daysInInventory / Math.max(1, avgAge);
    const agingSignal = Math.max(0, Math.min(100, 100 * (2 - ageRatio)));

    const lead = leadSignalFor(u.projectName, u.unitType, leads);
    const score = Math.round(lead.score * 0.5 + sellThroughPct * 0.3 + agingSignal * 0.2);

    return {
      id: u.id,
      code: u.code,
      projectName: u.projectName,
      unitType: u.unitType,
      floor: u.floor,
      basePriceEgp: u.basePriceEgp,
      score,
      factors: {
        activeLeadsInterested: lead.count,
        bestLeadStage: lead.bestStage,
        projectSellThroughPct: Math.round(sellThroughPct * 10) / 10,
        daysInInventory,
      },
    };
  });

  return results.sort((a, b) => b.score - a.score).slice(0, limit);
}
