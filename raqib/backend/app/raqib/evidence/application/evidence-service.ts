import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, Forbidden, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, FILE_STORAGE, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger, IFileStorage } from "@core/contracts/index.js";
import { requireCan, requireProject, type Access } from "@raqib/raqib/access/access.js";
import { ActionsService } from "@raqib/raqib/actions/application/actions-service.js";
import { evidenceOpen } from "@raqib/raqib/actions/domain/action-state.js";
import { ActionsRepository } from "@raqib/raqib/actions/infrastructure/actions-repository.js";
import { InspectionsService } from "@raqib/raqib/inspections/application/inspections-service.js";
import { SettingsService } from "@raqib/raqib/settings/application/settings-service.js";
import { VisitsRepository } from "@raqib/raqib/visits/infrastructure/visits-repository.js";
import { UploadGuard } from "@raqib/raqib/shared/upload-guard.js";
import { EvidenceRepository, type EvidenceKind, type EvidenceRecord } from "../infrastructure/evidence-repository.js";

/** What a file's MIME type means as evidence; anything else is refused. */
export function evidenceKind(mime: string): EvidenceKind | null {
  if (mime.startsWith("image/")) return "photo";
  if (mime.startsWith("video/")) return "video";
  if (mime === "application/pdf") return "doc";
  return null;
}

export interface AttachInput {
  fileId: string;
  inspectionId: string;
  itemId?: string | null;
  guardId?: string | null;
}

/**
 * Evidence = a PRIVATE Core file (presigned upload by the person, then confirmed) linked to its business
 * context. Raqib verifies the file really landed, was uploaded by the same person, and fits the attachment policy
 * (type and size) before linking it, and it is the only way the bytes are read back — the caller must be allowed
 * to read the record the evidence belongs to. Possessing a file id or storage key is never enough.
 */
@Injectable()
export class EvidenceService {
  constructor(
    private readonly repo: EvidenceRepository,
    private readonly inspections: InspectionsService,
    private readonly visits: VisitsRepository,
    private readonly actions: ActionsRepository,
    private readonly actionService: ActionsService,
    private readonly settings: SettingsService,
    private readonly guard: UploadGuard,
    @Inject(FILE_STORAGE) private readonly files: IFileStorage,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async attach(input: AttachInput, who: Access): Promise<EvidenceRecord> {
    const context = input.guardId ? "guard_eval" : "answer";
    requireCan(who, context === "guard_eval" ? "guardEval" : "inspections", "S");
    if (context === "answer" && !input.itemId) throw ValidationError("raqib.item_required", "Choose the inspection item this evidence supports.");
    let afterCommit = async (): Promise<void> => undefined;
    const record = await this.uow.transaction(async () => {
      const { v, item } = await this.inspections.assertEditable(input.inspectionId, who, input.itemId);
      if (context === "answer" && item?.kind !== "site") throw ValidationError("raqib.item_not_found", "Item not found.");
      if (context === "guard_eval") {
        const onVisit = ((await this.visits.guardIds([v.id])).get(v.id) ?? []).includes(input.guardId!);
        if (!onVisit) throw ValidationError("raqib.guard_not_on_visit", "This guard is not on this visit.");
      }
      const { file, kind, afterCommit: after } = await this.validateUpload(input.fileId, who);
      afterCommit = after;
      const id = await this.repo.insert({
        fileId: file.id,
        kind,
        name: file.originalName,
        mime: file.contentType,
        sizeBytes: file.byteSize,
        context,
        inspectionId: input.inspectionId,
        itemId: input.itemId ?? null,
        guardId: input.guardId ?? null,
        refId: null,
        uploadedBy: who.userId,
      });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.evidence.attached",
        resourceType: "raqib_evidence",
        resourceId: id,
        after: { kind, context, inspectionId: input.inspectionId, itemId: input.itemId ?? null },
      });
      return (await this.repo.find(id))!;
    });
    await afterCommit();
    return record;
  }

  /** A confirmed upload by this person, of an allowed type and size — shared by every evidence context. */
  private async validateUpload(fileId: string, who: Access) {
    const file = await this.files.describe(fileId).catch(() => null);
    if (!file) throw NotFound("raqib.file_not_found", "File not found.");
    if (file.status !== "stored") throw Conflict("raqib.file_not_stored", "The upload has not finished.");
    if (file.ownerId !== who.userId) throw Forbidden("raqib.file_not_yours", "You can only attach files you uploaded.");
    const kind = evidenceKind(file.contentType);
    if (!kind) throw ValidationError("raqib.file_type_not_allowed", "Only photos, videos and PDF documents can be attached.");
    const s = await this.settings.current();
    const limitMb = kind === "video" ? s.attach.video : kind === "doc" ? s.attach.doc : s.attach.photo;
    if (file.byteSize > limitMb * 1_048_576) throw ValidationError("raqib.file_too_large", `This file exceeds the ${limitMb} MB limit.`, { limitMb });
    const admitted = await this.guard.admit(file, kind, who.userId);
    return { file: admitted.file, kind, afterCommit: admitted.afterCommit };
  }

  /** Closure evidence for a corrective action: only the responsible person, only while the work is in progress. */
  async attachToAction(input: { fileId: string; actionId: string }, who: Access): Promise<EvidenceRecord> {
    requireCan(who, "actions", "S");
    let afterCommit = async (): Promise<void> => undefined;
    const record = await this.uow.transaction(async () => {
      const a = await this.actions.find(input.actionId, true);
      if (!a) throw NotFound("raqib.action_not_found", "Action not found.");
      requireProject(who, a.projectId);
      if (a.responsibleId !== who.userId) throw Forbidden("raqib.not_responsible", "Only the person responsible can attach closure evidence.");
      if (!evidenceOpen(a.status)) throw Conflict("raqib.evidence_closed", "Start the work before attaching closure evidence.");
      const { file, kind, afterCommit: after } = await this.validateUpload(input.fileId, who);
      afterCommit = after;
      const id = await this.repo.insert({
        fileId: file.id,
        kind,
        name: file.originalName,
        mime: file.contentType,
        sizeBytes: file.byteSize,
        context: "corrective_action",
        inspectionId: null,
        itemId: null,
        guardId: null,
        refId: a.id,
        uploadedBy: who.userId,
      });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.evidence.attached",
        resourceType: "raqib_evidence",
        resourceId: id,
        after: { kind, context: "corrective_action", actionId: a.id },
      });
      return (await this.repo.find(id))!;
    });
    await afterCommit();
    return record;
  }

  async remove(id: string, who: Access): Promise<void> {
    await this.uow.transaction(async () => {
      const e = await this.repo.find(id);
      if (!e || (!e.inspectionId && !e.refId)) throw NotFound("raqib.evidence_not_found", "Evidence not found.");
      if (e.uploadedBy !== who.userId) throw Forbidden("raqib.out_of_scope", "You can only remove your own evidence.");
      if (e.context === "corrective_action") {
        const a = await this.actions.find(e.refId!, true);
        if (!a || !evidenceOpen(a.status)) throw Conflict("raqib.evidence_closed", "Evidence can no longer be removed.");
      } else {
        await this.inspections.assertEditable(e.inspectionId!, who, e.itemId);
      }
      await this.repo.markRemoved(id);
      await this.files.delete({ id: e.fileId });
      await this.audit.record({ actorId: who.userId, action: "raqib.evidence.removed", resourceType: "raqib_evidence", resourceId: id });
    });
  }

  /** The bytes, only for someone who may read the inspection the evidence belongs to. Every read is audited. */
  async content(id: string, who: Access): Promise<{ content: Buffer; name: string; mime: string }> {
    return readInTenant(async () => {
      const e = await this.repo.find(id);
      if (!e || (!e.inspectionId && !e.refId)) throw NotFound("raqib.evidence_not_found", "Evidence not found.");
      if (e.context === "corrective_action") {
        await this.actionService.readable(e.refId!, who);
      } else {
        const v = await this.inspections.visitOf(e.inspectionId!);
        if (!v || !this.inspections.canRead(who, v)) throw Forbidden("raqib.out_of_scope", "This resource is outside your scope.");
      }
      const { content } = await this.files.getContent({ id: e.fileId });
      await this.audit.record({
        actorId: who.userId,
        action: "raqib.evidence.downloaded",
        resourceType: "raqib_evidence",
        resourceId: id,
        metadata: { kind: e.kind },
      });
      return { content, name: e.name, mime: e.mime };
    });
  }
}
