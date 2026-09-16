import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { PaymentPlansRepository } from "@atlas/realestate/sales/infrastructure/payment-plans-repository.js";
import { PaymentsRepository, type CreatePaymentInput, type PaymentFilter } from "../infrastructure/payments-repository.js";
import { FinanceQueries, type CollectionsFilter, type OutstandingFilter } from "../infrastructure/finance-queries.js";
import type { RecordPaymentBody } from "../validation/payments.schema.js";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository,
    private readonly installments: PaymentPlansRepository,
    private readonly queries: FinanceQueries,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(filter: PaymentFilter = {}) {
    return readInTenant(() => this.repo.list(filter));
  }

  collections(filter: CollectionsFilter = {}) {
    return readInTenant(() => this.queries.collectionsByProject(filter));
  }

  outstanding(filter: OutstandingFilter = {}) {
    return readInTenant(() => this.queries.outstandingAccounts(filter));
  }

  async record(body: RecordPaymentBody, actorId: string) {
    const input: CreatePaymentInput = body;
    return this.uow.transaction(async () => {
      const created = await this.repo.create(input);
      if (body.installmentId) {
        await this.installments.applyPayment(body.installmentId, body.amountEgp);
      }
      await this.audit.record({
        actorId,
        action: "realestate.payment.recorded",
        resourceType: "realestate_payment",
        resourceId: created.id,
        after: created,
      });
      return created;
    });
  }
}
