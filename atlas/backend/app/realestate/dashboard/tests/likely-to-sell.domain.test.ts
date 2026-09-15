import { describe, expect, it } from "vitest";
import {
  rankUnitsLikelyToSell,
  type LeadInterestInput,
  type LikelyToSellUnitInput,
  type ProjectVelocityInput,
} from "@atlas/realestate/dashboard/likely-to-sell.domain.js";

const NOW = new Date("2026-09-15T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function unit(over: Partial<LikelyToSellUnitInput> & { id: string }): LikelyToSellUnitInput {
  return {
    code: over.id,
    projectId: "prj_hills",
    projectName: "North Hills",
    unitType: "3-Bed",
    floor: 4,
    basePriceEgp: 4_850_000,
    createdAt: daysAgo(30),
    ...over,
  };
}

const PROJECTS: ProjectVelocityInput[] = [
  { id: "prj_hills", name: "North Hills", sellThroughPct: 80 },
  { id: "prj_cold", name: "West Avenue", sellThroughPct: 10 },
];

describe("realestate/dashboard likely-to-sell.domain", () => {
  it("a unit matching an active, late-stage lead in a fast-selling project scores near the top", () => {
    const leads: LeadInterestInput[] = [
      { interestText: "North Hills · 3-Bed", status: "negotiation", stage: "negotiation" },
    ];
    const [hot, cold] = rankUnitsLikelyToSell(
      [
        unit({ id: "A" }), // matches the lead, hot project
        unit({ id: "B", projectId: "prj_cold", projectName: "West Avenue", createdAt: daysAgo(200) }),
      ],
      PROJECTS,
      leads,
      NOW,
    );
    expect(hot.id).toBe("A");
    expect(hot.score).toBeGreaterThan(cold.score);
    expect(hot.factors.activeLeadsInterested).toBe(1);
    expect(hot.factors.bestLeadStage).toBe("negotiation");
  });

  it("lost leads and post-pipeline stages (reserved/contracted/sold/lost) never count as interest", () => {
    const leads: LeadInterestInput[] = [
      { interestText: "North Hills · 3-Bed", status: "lost", stage: "new" },
      { interestText: "North Hills · 3-Bed", status: "negotiation", stage: "sold" },
      { interestText: "North Hills · 3-Bed", status: "negotiation", stage: "reserved" },
    ];
    const [result] = rankUnitsLikelyToSell([unit({ id: "A" })], PROJECTS, leads, NOW);
    expect(result.factors.activeLeadsInterested).toBe(0);
    expect(result.factors.bestLeadStage).toBeNull();
  });

  it("a lead's interest text only counts for the project + unit type it actually mentions", () => {
    const leads: LeadInterestInput[] = [
      { interestText: "West Avenue · 1-Bed", status: "negotiation", stage: "negotiation" },
    ];
    const [result] = rankUnitsLikelyToSell(
      [unit({ id: "A", projectName: "North Hills", unitType: "3-Bed" })],
      PROJECTS,
      leads,
      NOW,
    );
    expect(result.factors.activeLeadsInterested).toBe(0);
  });

  it("more interested leads and a better stage both push the score up, capped at 100 for the lead component", () => {
    const oneLead: LeadInterestInput[] = [
      { interestText: "North Hills · 3-Bed", status: "new", stage: "new" },
    ];
    const manyLeads: LeadInterestInput[] = [
      { interestText: "North Hills · 3-Bed", status: "negotiation", stage: "negotiation" },
      { interestText: "North Hills · 3-Bed", status: "viewing", stage: "viewing" },
      { interestText: "North Hills · 3-Bed", status: "qualified", stage: "qualified" },
    ];
    const [low] = rankUnitsLikelyToSell([unit({ id: "A" })], PROJECTS, oneLead, NOW);
    const [high] = rankUnitsLikelyToSell([unit({ id: "A" })], PROJECTS, manyLeads, NOW);
    expect(high.score).toBeGreaterThan(low.score);
    expect(high.factors.activeLeadsInterested).toBe(3);
  });

  it("a unit far staler than its project's average scores lower on freshness than a fresh one, all else equal", () => {
    const [fresh, stale] = rankUnitsLikelyToSell(
      [
        unit({ id: "fresh", createdAt: daysAgo(5) }),
        unit({ id: "stale", createdAt: daysAgo(400) }),
      ],
      PROJECTS,
      [],
      NOW,
    );
    // Sorted descending by score — the fresher unit (lower average-relative age) wins the tie.
    expect(fresh.id).toBe("fresh");
    expect(fresh.score).toBeGreaterThan(stale.score);
  });

  it("respects the limit and sorts strictly by descending score", () => {
    const units = Array.from({ length: 5 }, (_, i) => unit({ id: `u${i}`, createdAt: daysAgo(i * 50) }));
    const results = rankUnitsLikelyToSell(units, PROJECTS, [], NOW, 3);
    expect(results).toHaveLength(3);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it("reports the project sell-through percentage and days-in-inventory it actually used", () => {
    const [result] = rankUnitsLikelyToSell([unit({ id: "A", createdAt: daysAgo(12) })], PROJECTS, [], NOW);
    expect(result.factors.projectSellThroughPct).toBe(80);
    expect(result.factors.daysInInventory).toBe(12);
  });
});
