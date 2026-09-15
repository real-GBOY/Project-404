import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { CustomersRepository, type CreateCustomerInput, type CustomerFilter } from "./customers-repository.js";
import type { CreateCustomerBody, UpdateCustomerBody } from "./customers.schema.js";

@Injectable()
export class CustomersService {
  constructor(
    private readonly repo: CustomersRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(filter: CustomerFilter = {}) {
    return readInTenant(async () => {
      const [rows, stats] = await Promise.all([this.repo.list(filter), this.repo.statsByCustomer()]);
      return rows.map((c) => {
        const s = stats.get(c.id) ?? { unitsOwned: 0, portfolioEgp: 0, collectedEgp: 0 };
        return { ...c, unitsOwned: s.unitsOwned, portfolioEgp: s.portfolioEgp, collectedEgp: s.collectedEgp };
      });
    });
  }

  async get(id: string) {
    const customer = await readInTenant(() => this.repo.findById(id));
    if (!customer) throw NotFound("customer.not_found", "Customer not found.");
    const unitsOwned = await readInTenant(() => this.repo.unitsOwned(id));
    return { ...customer, unitsOwned };
  }

  async create(body: CreateCustomerBody, actorId: string) {
    const input: CreateCustomerInput = body;
    return this.uow.transaction(async () => {
      const created = await this.repo.create(input);
      await this.audit.record({
        actorId,
        action: "realestate.customer.created",
        resourceType: "realestate_customer",
        resourceId: created.id,
        after: created,
      });
      return created;
    });
  }

  async update(id: string, body: UpdateCustomerBody, actorId: string) {
    return this.uow.transaction(async () => {
      const before = await this.repo.findById(id);
      if (!before) throw NotFound("customer.not_found", "Customer not found.");
      const updated = await this.repo.update(id, body);
      await this.audit.record({
        actorId,
        action: "realestate.customer.updated",
        resourceType: "realestate_customer",
        resourceId: id,
        before,
        after: updated,
      });
      return updated!;
    });
  }
}
