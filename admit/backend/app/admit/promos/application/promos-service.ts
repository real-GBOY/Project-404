import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import type { Principal } from "@core/http/principal.js";
import { isUniqueViolation } from "@admit/admit/shared/pg-errors.js";
import { EventAccess } from "@admit/admit/events/application/event-access.js";
import { discountFor, leavesSomethingToPay, unusableReason } from "../domain/pricing.js";
import { PromosRepository, type PromoRecord } from "../infrastructure/promos-repository.js";
import type { CreatePromoBody, UpdatePromoBody } from "../validation/promos.schema.js";

export interface PromoView extends PromoRecord {
  usedCount: number;
}

export interface PromoQuote {
  promo: PromoRecord;
  discountMinor: number;
}

const bad = (message: string) => ValidationError("admit.promo_invalid", message, { fields: [{ path: "promoCode", message }] });

/** Organizer side: define discount codes for an event. Guest side: price a code against an order. */
@Injectable()
export class PromosService {
  constructor(
    private readonly repo: PromosRepository,
    private readonly access: EventAccess,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  // ---- organizer ------------------------------------------------------------------------------
  list(who: Principal, eventId: string): Promise<PromoView[]> {
    return readInTenant(async () => {
      await this.access.assertEvent(who, eventId);
      return this.repo.listForEvent(eventId);
    });
  }

  async create(who: Principal, eventId: string, b: CreatePromoBody): Promise<PromoView> {
    try {
      return await this.uow.transaction(async () => {
        await this.access.assertEvent(who, eventId);
        const id = await this.repo.insert(eventId, b);
        await this.audit.record({ actorId: who.userId, action: "admit.promo.created", resourceType: "admit_promo_code", resourceId: id, after: { ...b } });
        return (await this.repo.listForEvent(eventId)).find((p) => p.id === id)!;
      });
    } catch (err) {
      if (isUniqueViolation(err, "admit_promo_codes_code_uq")) throw Conflict("admit.promo_code_taken", `The code ${b.code} already exists for this event.`);
      throw err;
    }
  }

  async update(who: Principal, id: string, b: UpdatePromoBody): Promise<PromoView> {
    return this.uow.transaction(async () => {
      const before = await this.repo.find(id);
      if (!before) throw NotFound("admit.promo_not_found", "Promo code not found.");
      await this.access.assertEvent(who, before.eventId);
      const kind = b.kind ?? before.kind;
      const value = b.value ?? before.value;
      if (kind === "percent" && value > 99)
        throw ValidationError("admit.promo_value", "A percentage must be between 1 and 99.", {
          fields: [{ path: "value", message: "A percentage must be between 1 and 99." }],
        });
      const from = b.validFrom === undefined ? before.validFrom : b.validFrom;
      const until = b.validUntil === undefined ? before.validUntil : b.validUntil;
      if (from && until && until <= from)
        throw ValidationError("admit.promo_window", "The end must be after the start.", {
          fields: [{ path: "validUntil", message: "The end must be after the start." }],
        });
      await this.repo.update(id, b);
      await this.audit.record({
        actorId: who.userId,
        action: "admit.promo.updated",
        resourceType: "admit_promo_code",
        resourceId: id,
        before: { code: before.code, enabled: before.enabled },
        after: { ...b },
      });
      return (await this.repo.listForEvent(before.eventId)).find((p) => p.id === id)!;
    });
  }

  async remove(who: Principal, id: string): Promise<void> {
    await this.uow.transaction(async () => {
      const before = await this.repo.find(id);
      if (!before) throw NotFound("admit.promo_not_found", "Promo code not found.");
      await this.access.assertEvent(who, before.eventId);
      await this.repo.remove(id); // bookings keep the code text they were priced with
      await this.audit.record({
        actorId: who.userId,
        action: "admit.promo.deleted",
        resourceType: "admit_promo_code",
        resourceId: id,
        before: { code: before.code },
      });
    });
  }

  // ---- guest ----------------------------------------------------------------------------------
  /**
   * Prices `code` against an order. With `lock` it holds the code's row until the surrounding transaction ends, so the
   * "N uses" limit holds even when several guests redeem the last use at once (the booking is inserted in that transaction).
   */
  async price(eventId: string, code: string, subtotalMinor: number, now: Date, lock: boolean): Promise<PromoQuote> {
    const promo = await (lock ? this.repo.lockByCode(eventId, code) : this.repo.findByCode(eventId, code));
    if (!promo) throw bad("That code is not valid for this event.");
    const reason = unusableReason(promo, await this.repo.usedCount(promo.id), now);
    if (reason) throw bad(reason);
    const discountMinor = discountFor(promo, subtotalMinor);
    if (!leavesSomethingToPay(subtotalMinor, discountMinor)) throw bad("That code covers the whole order, so it cannot be applied here.");
    return { promo, discountMinor };
  }
}
