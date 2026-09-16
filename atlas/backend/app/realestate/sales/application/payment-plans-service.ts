import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { ContractsRepository } from "../infrastructure/contracts-repository.js";
import { PaymentPlansRepository, type CreatePaymentPlanInput, type InstallmentFilter } from "../infrastructure/payment-plans-repository.js";
import { generateInstallmentSchedule } from "../domain/payment-plan.domain.js";
import type { CreatePaymentPlanBody } from "../validation/payment-plans.schema.js";

@Injectable()
export class PaymentPlansService {
  constructor(
    private readonly repo: PaymentPlansRepository,
    private readonly contracts: ContractsRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  /** Flat, org-wide installment list (the Installments screen — not scoped to one plan). */
  listInstallments(filter: InstallmentFilter = {}) {
    return readInTenant(() => this.repo.listInstallmentsWithContext(filter));
  }

  /** Flat, org-wide plan list (the Payment Plans screen — not scoped to one contract). */
  listAll() {
    return readInTenant(() => this.repo.listAll());
  }

  async get(id: string) {
    const plan = await readInTenant(() => this.repo.findById(id));
    if (!plan) throw NotFound("payment_plan.not_found", "Payment plan not found.");
    const installments = await readInTenant(() => this.repo.installmentsForPlan(id));
    return { ...plan, installments };
  }

  async getForContract(contractId: string) {
    const plan = await readInTenant(() => this.repo.findByContract(contractId));
    if (!plan) throw NotFound("payment_plan.not_found", "This contract has no payment plan yet.");
    const installments = await readInTenant(() => this.repo.installmentsForPlan(plan.id));
    return { ...plan, installments };
  }

  async create(body: CreatePaymentPlanBody, actorId: string) {
    return this.uow.transaction(async () => {
      const contract = await this.contracts.findById(body.contractId);
      if (!contract) throw NotFound("contract.not_found", "Contract not found.");
      const existing = await this.repo.findByContract(body.contractId);
      if (existing) throw Conflict("payment_plan.exists", "This contract already has a payment plan.");

      const input: CreatePaymentPlanInput = {
        contractId: contract.id,
        unitId: contract.unitId,
        customerId: contract.customerId,
        totalEgp: contract.valueEgp,
        downPaymentPct: body.downPaymentPct,
        installmentCount: body.installmentCount,
        cadence: body.cadence,
        startDate: body.startDate,
      };
      const plan = await this.repo.create(input);
      const schedule = generateInstallmentSchedule({
        totalEgp: input.totalEgp,
        downPaymentPct: input.downPaymentPct,
        installmentCount: input.installmentCount,
        cadence: input.cadence,
        startDate: input.startDate,
      });
      await this.repo.insertInstallments(plan.id, schedule);
      await this.audit.record({
        actorId,
        action: "realestate.payment_plan.created",
        resourceType: "realestate_payment_plan",
        resourceId: plan.id,
        after: plan,
      });
      const installments = await this.repo.installmentsForPlan(plan.id);
      return { ...plan, installments };
    });
  }
}
