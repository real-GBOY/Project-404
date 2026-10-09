import { Inject, Injectable } from "@nestjs/common";
import { readInTenant, type UnitOfWork } from "@core/kernel/db/db.js";
import { Forbidden, NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, FILE_STORAGE, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IFileStorage } from "@core/contracts/index.js";
import { can, inScope, requireCan, type Access } from "@raqib/raqib/access/access.js";
import { InspectionsService } from "@raqib/raqib/inspections/application/inspections-service.js";
import { EvidenceRepository } from "@raqib/raqib/evidence/infrastructure/evidence-repository.js";
import { ObservationsRepository } from "@raqib/raqib/observations/infrastructure/observations-repository.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { VisitsService } from "@raqib/raqib/visits/application/visits-service.js";
import { renderReportHtml, type Lang } from "../domain/report-html.js";
import { BrandingService } from "@raqib/raqib/shared/branding.js";
import { buildSnapshot, type ReportSnapshot } from "../domain/report-snapshot.js";
import { ReportsRepository, type ReportRecord } from "../infrastructure/reports-repository.js";
import type { Page } from "@raqib/raqib/shared/paging.js";

export interface ReportView {
  id: string;
  ref: string;
  visitId: string;
  projectId: string;
  scorePct: number | null;
  issuedAt: string;
  snapshot: ReportSnapshot;
}

const toView = (r: ReportRecord): ReportView => ({
  id: r.id,
  ref: r.ref,
  visitId: r.visitId,
  projectId: r.projectId,
  scorePct: r.scorePct,
  issuedAt: r.generatedAt.toISOString(),
  snapshot: r.snapshot,
});

/** Photos beyond these limits are listed by name in the PDF instead of embedded, so one report never balloons. */
const MAX_IMAGES = 40;
const MAX_IMAGE_BYTES = 4 * 1_048_576;

@Injectable()
export class ReportsService {
  constructor(
    private readonly repo: ReportsRepository,
    private readonly visits: VisitsService,
    private readonly inspections: InspectionsService,
    private readonly projects: ProjectsRepository,
    private readonly evidence: EvidenceRepository,
    private readonly branding: BrandingService,
    private readonly observations: ObservationsRepository,
    @Inject(FILE_STORAGE) private readonly files: IFileStorage,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /** Freeze the approved inspection into a report. Runs inside the approval transaction, once per visit. */
  async issue(visitId: string, who: Access): Promise<ReportView> {
    return this.uow.transaction(async () => {
      const existing = await this.repo.findByVisit(visitId);
      if (existing) return toView(existing);
      const visit = await this.visits.get(visitId, who);
      const all = await this.inspections.getAll(visitId, who);
      if (!all.length) throw NotFound("raqib.inspection_not_started", "This visit has no inspection.");
      const inspection = all[0]!;
      const guards = new Map(
        (await this.projects.guards()).filter((g) => visit.guardIds.includes(g.id)).map((g) => [g.id, { employeeNo: g.employeeNo, name: g.name }]),
      );
      const ref = `RPT-${visit.ref.replace(/^VIS-/, "")}`;
      const parts = await Promise.all(all.map(async (i) => ({ inspection: i, violations: await this.observations.forInspection(i.id) })));
      const shiftName = (await this.visits.shifts()).find((s) => s.key === visit.shift)?.name;
      const brand = await this.branding.current();
      const snapshot = buildSnapshot({
        ref,
        issuedAt: this.clock.now(),
        visit,
        inspections: parts,
        guards,
        approver: who,
        shiftName,
        org: { name: brand.name, logoFileId: brand.logoFileId },
      });
      const scorePct = snapshot.overallPct !== undefined ? snapshot.overallPct : inspection.score.pct;
      const id = await this.repo.insert({
        visitId,
        inspectionId: inspection.id,
        projectId: visit.project.id,
        ref,
        scorePct,
        snapshot,
        approvedBy: who.userId,
        approvedByNameAr: who.nameAr,
        approvedByNameEn: who.nameEn,
      });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.report.issued",
        resourceType: "raqib_report",
        resourceId: id,
        after: { ref, visitId, scorePct, issueNos: all.map((i) => i.issueNo) },
      });
      return toView((await this.repo.find(id))!);
    });
  }

  async list(who: Access, page?: Page): Promise<ReportView[]> {
    requireCan(who, "reports", "V");
    const rows = await readInTenant(() => this.repo.list(who.allProjects ? undefined : [...who.projectIds], page));
    return rows.map(toView);
  }

  async get(id: string, who: Access): Promise<ReportView> {
    return toView(await this.readable(id, who));
  }

  async forVisit(visitId: string, who: Access): Promise<ReportView | null> {
    const r = await readInTenant(() => this.repo.findByVisit(visitId));
    if (!r || !inScope(who, r.projectId) || !can(who, "reports", "V")) return null;
    return toView(r);
  }

  /**
   * Issued reports are immutable, so a rendered PDF never goes stale: the last few are kept in memory (bounded by count
   * and bytes) and served again without rendering. Authorization and the download audit still run on every request.
   */
  /**
   * The report as one self-contained, print-ready HTML page, built from the frozen snapshot (evidence photos embedded), authorized by
   * project scope and the download right, and audited. The browser prints it ("Save as PDF"), so the server never renders a PDF.
   */
  async printableOf(id: string, lang: Lang, who: Access): Promise<{ name: string; html: string }> {
    requireCan(who, "reports", "D");
    const r = await this.readable(id, who);
    const images = new Map<string, string>();
    let n = 0;
    const parts = [r.snapshot, ...(r.snapshot.extraForms ?? [])];
    for (const e of parts.flatMap((p) => p.sections.flatMap((s) => s.items.flatMap((it) => it.evidence)))) {
      if (e.kind !== "photo" || n >= MAX_IMAGES) continue;
      try {
        const rec = await this.evidenceFile(e.id);
        if (!rec || rec.content.byteLength > MAX_IMAGE_BYTES) continue;
        images.set(e.id, `data:${e.mime};base64,${rec.content.toString("base64")}`);
        n += 1;
      } catch {
        // an evidence file that cannot be read is simply not embedded
      }
    }
    const logo = await this.branding.logoOf(r.snapshot.org?.logoFileId);
    if (logo) images.set("__logo__", logo);
    const html = renderReportHtml(r.snapshot, lang, images);
    await this.auditDownload(r.id, who, lang, Buffer.byteLength(html), false);
    return { name: `${r.ref}-${lang}`, html };
  }

  private auditDownload(reportId: string, who: Access, lang: Lang, bytes: number, cached: boolean): Promise<void> {
    return this.uow.transaction(() =>
      this.audit.record({
        actorId: who.userId,
        action: "raqib.report.downloaded",
        resourceType: "raqib_report",
        resourceId: reportId,
        metadata: { lang, bytes, cached },
      }),
    );
  }

  private async readable(id: string, who: Access): Promise<ReportRecord> {
    requireCan(who, "reports", "V");
    const r = await readInTenant(() => this.repo.find(id));
    if (!r) throw NotFound("raqib.report_not_found", "Report not found.");
    if (!inScope(who, r.projectId)) throw Forbidden("raqib.out_of_scope", "This report belongs to a project outside your scope.");
    return r;
  }

  private async evidenceFile(evidenceId: string): Promise<{ content: Buffer } | null> {
    const e = await readInTenant(() => this.evidence.find(evidenceId));
    return e ? this.files.getContent({ id: e.fileId }) : null;
  }
}
