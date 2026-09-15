import { Inject, Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import type { Clock } from "@core/kernel/clock.js";
import { CLOCK } from "@core/kernel/tokens.js";
import { ProjectsRepository } from "@atlas/realestate/properties/projects-repository.js";
import { UnitsRepository } from "@atlas/realestate/properties/units-repository.js";
import { LeadsRepository } from "@atlas/realestate/crm/leads-repository.js";
import { ActivitiesRepository } from "@atlas/realestate/crm/activities-repository.js";
import { FinanceQueries } from "@atlas/realestate/finance/finance-queries.js";
import { rankUnitsLikelyToSell } from "./likely-to-sell.domain.js";

const STAGES = ["new", "qualified", "contacted", "viewing", "negotiation", "reserved", "contracted", "sold", "lost"] as const;

/**
 * Read-composition only (parallel queries across domains), no table of its
 * own, never calls another domain's *service* — only repositories/queries —
 * same rule as Mizan's dashboard module. Backs the Executive Dashboard and
 * the Analytics screens.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly projects: ProjectsRepository,
    private readonly units: UnitsRepository,
    private readonly leads: LeadsRepository,
    private readonly activities: ActivitiesRepository,
    private readonly finance: FinanceQueries,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  summary() {
    return readInTenant(async () => {
      const [projects, availability, funnel, recentActivity, collections] = await Promise.all([
        this.projects.list(),
        this.units.availabilitySummary(),
        Promise.all(STAGES.map(async (stage) => ({ stage, count: (await this.leads.list({ stage })).length }))),
        this.activities.list(),
        this.finance.collectionsByProject(),
      ]);

      const totals = projects.reduce(
        (acc, p) => ({
          totalUnits: acc.totalUnits + p.totalUnits,
          soldUnits: acc.soldUnits + p.soldUnits,
          reservedUnits: acc.reservedUnits + p.reservedUnits,
          availableUnits: acc.availableUnits + p.availableUnits,
          totalValueEgp: acc.totalValueEgp + p.totalValueEgp,
          revenueEgp: acc.revenueEgp + p.revenueEgp,
        }),
        { totalUnits: 0, soldUnits: 0, reservedUnits: 0, availableUnits: 0, totalValueEgp: 0, revenueEgp: 0 },
      );

      return {
        projectCount: projects.length,
        ...totals,
        projects: projects.map((p) => ({ id: p.id, name: p.name, soldUnits: p.soldUnits, totalUnits: p.totalUnits, revenueEgp: p.revenueEgp, velocityPerWeek: p.velocityPerWeek, sellThroughPct: p.sellThroughPct })),
        inventoryByType: availability,
        leadFunnel: funnel,
        recentActivity: recentActivity.slice(0, 10),
        collectionsByProject: collections,
      };
    });
  }

  /**
   * "Which available units are likely to sell soon" — a composite,
   * explainable score over real Atlas data (see likely-to-sell.domain.ts for
   * the formula). Backs the Copilot's `get_units_likely_to_sell` tool; not
   * currently surfaced in the web UI.
   */
  unitsLikelyToSell(limit = 15) {
    return readInTenant(async () => {
      const [available, projects, leads] = await Promise.all([
        this.units.list({ status: "available" }),
        this.projects.list(),
        this.leads.list({}),
      ]);

      return {
        methodology:
          "Composite score (0-100, not a guarantee): 50% active lead interest in this project + unit type, " +
          "30% the project's real sell-through rate, 20% how fresh this unit is vs. its project's average time " +
          "in inventory. All inputs are live Atlas data — no external market data or speculation.",
        units: rankUnitsLikelyToSell(
          available.map((u) => ({
            id: u.id,
            code: u.code,
            projectId: u.projectId,
            projectName: projects.find((p) => p.id === u.projectId)?.name ?? u.projectId,
            unitType: u.unitType,
            floor: u.floor,
            basePriceEgp: u.basePriceEgp,
            createdAt: u.createdAt,
          })),
          projects.map((p) => ({ id: p.id, name: p.name, sellThroughPct: Number(p.sellThroughPct) })),
          leads.map((l) => ({ interestText: l.interestText, status: l.status, stage: l.stage })),
          this.clock.now(),
          limit,
        ),
      };
    });
  }
}
