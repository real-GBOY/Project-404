import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { PaymentPlansRepository } from "@atlas/realestate/sales/payment-plans-repository.js";
import { PaymentsRepository, type CreatePaymentInput } from "./payments-repository.js";
import { FinanceQueries } from "./finance-queries.js";
import type { RecordPaymentBody } from "./payments.schema.js";

@Injectable()
export class PaymentsService {
  constructor(
    private readonly repo: PaymentsRepository,
    private readonly installments: PaymentPlansRepository,
    private readonly queries: FinanceQueries,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(customerId?: string) {
    return readInTenant(() => this.repo.list(customerId));
  }

  collections() {
    return readInTenant(() => this.queries.collectionsByProject());
  }

  outstanding() {
    return readInTenant(() => this.queries.outstandingAccounts());
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
