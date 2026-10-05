import { Inject, Injectable } from "@nestjs/common";
import { readInTenant, type UnitOfWork } from "@core/kernel/db/db.js";
import { Forbidden, NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, FILE_STORAGE, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger, IFileStorage } from "@core/contracts/index.js";
import { can, inScope, requireCan, type Access } from "@raqib/raqib/access/access.js";
import { InspectionsService } from "@raqib/raqib/inspections/application/inspections-service.js";
import { EvidenceRepository } from "@raqib/raqib/evidence/infrastructure/evidence-repository.js";
import { ProjectsRepository } from "@raqib/raqib/projects/infrastructure/projects-repository.js";
import { VisitsService } from "@raqib/raqib/visits/application/visits-service.js";
import { renderReportHtml, type Lang } from "../domain/report-html.js";
import { buildSnapshot, type ReportSnapshot } from "../domain/report-snapshot.js";
import { PdfRenderer } from "../infrastructure/pdf-renderer.js";
import { ReportsRepository, type ReportRecord } from "../infrastructure/reports-repository.js";

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
  id: r.id, ref: r.ref, visitId: r.visitId, projectId: r.projectId, scorePct: r.scorePct, issuedAt: r.generatedAt.toISOString(), snapshot: r.snapshot,
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
    private readonly pdf: PdfRenderer,
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
      const inspection = await this.inspections.get(visitId, who);
      const guards = new Map((await this.projects.guards()).filter((g) => visit.guardIds.includes(g.id)).map((g) => [g.id, { employeeNo: g.employeeNo, name: g.name }]));
      const ref = `RPT-${visit.ref.replace(/^VIS-/, "")}`;
      const snapshot = buildSnapshot({ ref, issuedAt: this.clock.now(), visit, inspection, guards, approver: who });
      const id = await this.repo.insert({
        visitId, inspectionId: inspection.id, projectId: visit.project.id, ref, scorePct: inspection.score.pct, snapshot, approvedBy: who.userId,
        approvedByNameAr: who.nameAr, approvedByNameEn: who.nameEn,
      });
      await this.audit.record({ actorId: who.userId, action: "raqib.report.issued", resourceType: "raqib_report", resourceId: id, after: { ref, visitId, scorePct: inspection.score.pct } });
      return toView((await this.repo.find(id))!);
    });
  }

  async list(who: Access): Promise<ReportView[]> {
    requireCan(who, "reports", "V");
    const rows = await readInTenant(() => this.repo.list(who.allProjects ? undefined : [...who.projectIds]));
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

  /** The PDF, rendered from the frozen snapshot, authorized by project scope and the download right, and audited. */
  async pdfOf(id: string, lang: Lang, who: Access): Promise<{ name: string; content: Buffer }> {
    requireCan(who, "reports", "D");
    const r = await this.readable(id, who);
    const images = new Map<string, string>();
    let n = 0;
    for (const e of r.snapshot.sections.flatMap((s) => s.items.flatMap((it) => it.evidence))) {
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
    const content = await this.pdf.render(renderReportHtml(r.snapshot, lang, images));
    await this.uow.transaction(() => this.audit.record({ actorId: who.userId, action: "raqib.report.downloaded", resourceType: "raqib_report", resourceId: r.id, metadata: { lang, bytes: content.byteLength } }));
    return { name: `${r.ref}-${lang}.pdf`, content };
  }

  pdfAvailable(): boolean {
    return this.pdf.available();
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
