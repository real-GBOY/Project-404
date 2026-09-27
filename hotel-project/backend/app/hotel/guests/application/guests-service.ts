import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { UserDirectory } from "@core/identity/application/user-directory.js";
import { isUniqueViolation } from "@hotel/hotel/shared/pg-errors.js";
import {
  GuestsRepository,
  type GuestFilter,
  type GuestInput,
  type GuestRecord,
} from "../infrastructure/guests-repository.js";

export interface GuestProfile extends GuestRecord {
  notes: Array<{ id: string; body: string; authorName: string; createdAt: Date }>;
}

/**
 * Guests are the hotel's source of truth for a person. Identity documents are personal data:
 * every change is audited, and the audit trail records which fields changed rather than copying
 * document numbers into it.
 */
@Injectable()
export class GuestsService {
  constructor(
    private readonly repo: GuestsRepository,
    private readonly directory: UserDirectory,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  search(filter: GuestFilter) {
    return readInTenant(() => this.repo.search(filter));
  }

  async get(id: string): Promise<GuestProfile> {
    return readInTenant(async () => {
      const guest = await this.repo.findById(id);
      if (!guest) throw NotFound("guest.not_found", "Guest not found.");
      const notes = await this.repo.notes(id);
      const names = await this.directory.userNames(notes.map((n) => n.authorId));
      return {
        ...guest,
        notes: notes.map((n) => ({
          id: n.id,
          body: n.body,
          authorName: names.get(n.authorId) ?? "—",
          createdAt: n.createdAt,
        })),
      };
    });
  }

  async create(input: GuestInput, actorId: string): Promise<GuestRecord> {
    try {
      return await this.uow.transaction(async () => {
        const id = await this.repo.create(input, actorId);
        const created = (await this.repo.findById(id))!;
        await this.audit.record({
          actorId,
          action: "hotel.guest.created",
          resourceType: "hotel_guest",
          resourceId: id,
          after: { fullName: created.fullName, vip: created.vip },
        });
        return created;
      });
    } catch (err) {
      throw this.translate(err);
    }
  }

  async update(id: string, patch: Partial<GuestInput>, actorId: string): Promise<GuestRecord> {
    try {
      return await this.uow.transaction(async () => {
        const before = await this.repo.findById(id);
        if (!before) throw NotFound("guest.not_found", "Guest not found.");
        const merged = { ...before, ...patch };
        if (!merged.phone && !merged.email) {
          throw ValidationError(
            "guest.contact_required",
            "A guest needs a phone number or an email.",
          );
        }
        if (Boolean(merged.idDocumentType) !== Boolean(merged.idDocumentNumber)) {
          throw ValidationError(
            "guest.document_incomplete",
            "Document type and number go together.",
          );
        }
        await this.repo.update(id, patch);
        const after = (await this.repo.findById(id))!;
        await this.audit.record({
          actorId,
          action: "hotel.guest.updated",
          resourceType: "hotel_guest",
          resourceId: id,
          after: { changedFields: Object.keys(patch) },
        });
        return after;
      });
    } catch (err) {
      throw this.translate(err);
    }
  }

  addNote(guestId: string, body: string, actorId: string) {
    return this.uow.transaction(async () => {
      const guest = await this.repo.findById(guestId);
      if (!guest) throw NotFound("guest.not_found", "Guest not found.");
      const id = await this.repo.addNote(guestId, actorId, body);
      await this.audit.record({
        actorId,
        action: "hotel.guest.note_added",
        resourceType: "hotel_guest",
        resourceId: guestId,
        after: { noteId: id },
      });
      return { id };
    });
  }

  private translate(err: unknown): unknown {
    if (isUniqueViolation(err, "hotel_guests_email_uq")) {
      return Conflict("guest.email_taken", "Another guest already uses that email.");
    }
    return err;
  }
}
