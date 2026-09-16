import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { PriceListsRepository, type CreatePriceListInput, type PriceListFilter } from "../infrastructure/price-lists-repository.js";
import type { CreatePriceListBody, UpdatePriceListBody } from "../validation/price-lists.schema.js";

@Injectable()
export class PriceListsService {
  constructor(
    private readonly repo: PriceListsRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  listForProject(filter: PriceListFilter = {}) {
    return readInTenant(() => this.repo.listForProject(filter));
  }

  async create(body: CreatePriceListBody, actorId: string) {
    const input: CreatePriceListInput = body;
    return this.uow.transaction(async () => {
      const created = await this.repo.create(input);
      await this.audit.record({
        actorId,
        action: "realestate.price_list.created",
        resourceType: "realestate_price_list",
        resourceId: created.id,
        after: created,
      });
      return created;
    });
  }

  async update(id: string, body: UpdatePriceListBody, actorId: string) {
    return this.uow.transaction(async () => {
      const before = await this.repo.findById(id);
      if (!before) throw NotFound("price_list.not_found", "Price list not found.");
      const updated = await this.repo.update(id, body);
      await this.audit.record({
        actorId,
        action: "realestate.price_list.updated",
        resourceType: "realestate_price_list",
        resourceId: id,
        before,
        after: updated,
      });
      return updated!;
    });
  }
}
