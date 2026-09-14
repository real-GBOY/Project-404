import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type InsightKind = "dashboard" | "feed";

export interface InsightRow {
  id: string;
  kind: InsightKind;
  tag: string;
  confidence: string;
  text: string;
  detail: string;
  cta: string;
  targetRoute: string | null;
  dismissedBy: string | null;
  dismissedAt: Date | null;
}

export interface CreateInsightInput {
  kind: InsightKind;
  tag: string;
  confidence: number;
  text: string;
  detail: string;
  cta: string;
  targetRoute?: string | null;
}

@Injectable()
export class InsightsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(kind: InsightKind): Promise<InsightRow[]> {
    const rows = await realestateDb()
      .selectFrom("realestate_ai_insights")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("kind", "=", kind)
      .where("dismissed_at", "is", null)
      .orderBy("created_at", "desc")
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async create(input: CreateInsightInput): Promise<InsightRow> {
    const id = realestateId("aig");
    await realestateDb()
      .insertInto("realestate_ai_insights")
      .values({
        id,
        organization_id: this.org(),
        kind: input.kind,
        tag: input.tag,
        confidence: String(input.confidence),
        text: input.text,
        detail: input.detail,
        cta: input.cta,
        target_route: input.targetRoute ?? null,
      })
      .execute();
    const row = await realestateDb()
      .selectFrom("realestate_ai_insights")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();
    return this.toRow(row);
  }

  async dismiss(id: string, userId: string): Promise<void> {
    await realestateDb()
      .updateTable("realestate_ai_insights")
      .set({ dismissed_by: userId, dismissed_at: new Date() })
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .execute();
  }

  private toRow(r: {
    id: string;
    kind: InsightKind;
    tag: string;
    confidence: string;
    text: string;
    detail: string;
    cta: string;
    target_route: string | null;
    dismissed_by: string | null;
    dismissed_at: Date | string | null;
  }): InsightRow {
    return {
      id: r.id,
      kind: r.kind,
      tag: r.tag,
      confidence: r.confidence,
      text: r.text,
      detail: r.detail,
      cta: r.cta,
      targetRoute: r.target_route,
      dismissedBy: r.dismissed_by,
      dismissedAt: r.dismissed_at ? new Date(r.dismissed_at) : null,
    };
  }
}
