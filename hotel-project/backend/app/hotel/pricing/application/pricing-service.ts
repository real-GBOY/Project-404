import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound, ValidationError } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import type { IsoDate } from "@hotel/hotel/shared/dates.js";
import { isUniqueViolation } from "@hotel/hotel/shared/pg-errors.js";
import { RoomTypesRepository } from "@hotel/hotel/rooms/infrastructure/room-types-repository.js";
import { quoteStay, type Quote } from "../domain/pricing.js";
import {
  PricingRepository,
  type DiscountInput,
  type RateRuleInput,
} from "../infrastructure/pricing-repository.js";

/**
 * Rate rules, discount codes, and the ONE way a stay gets a price: `quote()`. Reservations, the
 * availability search and (later) the public booking engine all call it inside their own
 * transaction, so the price a guest is charged is always recomputed server-side.
 */
@Injectable()
export class PricingService {
  constructor(
    private readonly repo: PricingRepository,
    private readonly roomTypes: RoomTypesRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /** Inside an existing tenant transaction. */
  async quote(input: {
    roomTypeId: string;
    arrival: IsoDate;
    departure: IsoDate;
    discountCode?: string | null;
  }): Promise<Quote> {
    const type = await this.roomTypes.findById(input.roomTypeId);
    if (!type || type.archivedAt) {
      throw NotFound("room_type.not_found", "Room type not found.");
    }
    const rules = await this.repo.rules();
    let discount = null;
    if (input.discountCode) {
      discount = await this.repo.discountByCode(input.discountCode);
      if (!discount)
        throw ValidationError("pricing.unknown_discount", "That discount code doesn't exist.");
    }
    return quoteStay({
      arrival: input.arrival,
      departure: input.departure,
      roomTypeId: type.id,
      baseRate: type.baseRate,
      rules,
      discount,
    });
  }

  async list() {
    return readInTenant(async () => ({
      rules: await this.repo.rules(),
      discounts: await this.repo.discounts(),
    }));
  }

  createRule(input: RateRuleInput, actorId: string) {
    return this.uow.transaction(async () => {
      if (input.roomTypeId) {
        const type = await this.roomTypes.findById(input.roomTypeId);
        if (!type)
          throw ValidationError("pricing.unknown_room_type", "That room type does not exist.");
      }
      const id = await this.repo.createRule(input);
      await this.audit.record({
        actorId,
        action: "hotel.rate_rule.created",
        resourceType: "hotel_rate_rule",
        resourceId: id,
        after: input,
      });
      return { id };
    });
  }

  archiveRule(id: string, actorId: string) {
    return this.uow.transaction(async () => {
      if (!(await this.repo.archiveRule(id, this.clock.now()))) {
        throw NotFound("pricing.rule_not_found", "Rate rule not found.");
      }
      await this.audit.record({
        actorId,
        action: "hotel.rate_rule.archived",
        resourceType: "hotel_rate_rule",
        resourceId: id,
      });
      return { ok: true };
    });
  }

  async createDiscount(input: DiscountInput, actorId: string) {
    try {
      return await this.uow.transaction(async () => {
        const id = await this.repo.createDiscount(input);
        await this.audit.record({
          actorId,
          action: "hotel.discount.created",
          resourceType: "hotel_discount",
          resourceId: id,
          after: input,
        });
        return { id };
      });
    } catch (err) {
      if (isUniqueViolation(err, "hotel_discounts_code_uq")) {
        throw Conflict(
          "pricing.discount_code_taken",
          `Discount code ${input.code} already exists.`,
        );
      }
      throw err;
    }
  }

  archiveDiscount(id: string, actorId: string) {
    return this.uow.transaction(async () => {
      if (!(await this.repo.archiveDiscount(id, this.clock.now()))) {
        throw NotFound("pricing.discount_not_found", "Discount not found.");
      }
      await this.audit.record({
        actorId,
        action: "hotel.discount.archived",
        resourceType: "hotel_discount",
        resourceId: id,
      });
      return { ok: true };
    });
  }
}
