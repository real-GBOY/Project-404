import { describe, expect, it } from "vitest";
import { rankProjects, type RankFacts } from "./project-ranking.js";

const L = (s: string) => ({ ar: s, en: s });
const equal = { observations: 1, improvement: 1, complaints: 1, contract: 1 };
const fact = (id: string, over: Partial<RankFacts> = {}): RankFacts => ({
  projectId: id,
  project: L(id),
  avg: 80,
  n: 3,
  observations: 0,
  improvement: 0,
  complaints: 0,
  contractEnd: null,
  employeesAssigned: null,
  daysToContractEnd: null,
  ...over,
});

describe("project ranking", () => {
  const facts = [
    fact("calm", { observations: 1, improvement: 6, complaints: 0, daysToContractEnd: 400 }),
    fact("busy", { observations: 12, improvement: -4, complaints: 3, daysToContractEnd: 300 }),
    fact("ending", { observations: 4, improvement: 1, complaints: 1, daysToContractEnd: 20 }),
  ];

  it("puts the project that needs attention first, using all four indicators", () => {
    const r = rankProjects(facts, "attention", equal);
    expect(r.map((p) => p.projectId)).toEqual(["busy", "ending", "calm"]);
    expect(r[0]!.attention).toBeGreaterThan(r[2]!.attention);
  });

  it("orders by one indicator when asked", () => {
    expect(rankProjects(facts, "observations", equal).map((p) => p.projectId)).toEqual(["busy", "ending", "calm"]);
    expect(rankProjects(facts, "improvement", equal).map((p) => p.projectId)).toEqual(["busy", "ending", "calm"]);
    expect(rankProjects(facts, "complaints", equal).map((p) => p.projectId)).toEqual(["busy", "ending", "calm"]);
    expect(rankProjects(facts, "contract", equal).map((p) => p.projectId)).toEqual(["ending", "busy", "calm"]);
    expect(rankProjects(facts, "score", equal).map((p) => p.projectId)[0]).toBeDefined();
  });

  it("follows the weights: an indicator weighted 0 does not count", () => {
    const onlyContract = rankProjects(facts, "attention", { observations: 0, improvement: 0, complaints: 0, contract: 1 });
    expect(onlyContract[0]!.projectId).toBe("ending");
    expect(rankProjects(facts, "attention", { observations: 0, improvement: 0, complaints: 0, contract: 0 }).every((p) => p.attention === 0)).toBe(true);
  });

  it("never invents a complaint figure: without access it stays null and does not move the order", () => {
    const hidden = facts.map((f) => ({ ...f, complaints: null }));
    const r = rankProjects(hidden, "attention", equal);
    expect(r.every((p) => p.complaints === null)).toBe(true);
    const withNoComplaintsWeight = rankProjects(facts, "attention", { ...equal, complaints: 0 });
    expect(r.map((p) => p.projectId)).toEqual(withNoComplaintsWeight.map((p) => p.projectId));
  });

  it("copes with a project that has no data and with an expired contract", () => {
    const r = rankProjects(
      [fact("empty", { avg: null, n: 0, improvement: null }), fact("expired", { daysToContractEnd: -10, observations: 2 })],
      "attention",
      equal,
    );
    expect(r).toHaveLength(2);
    expect(r[0]!.projectId).toBe("expired");
    expect(rankProjects([], "attention", equal)).toEqual([]);
  });
});
