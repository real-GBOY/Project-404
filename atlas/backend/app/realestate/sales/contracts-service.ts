import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { UnitsRepository } from "@atlas/realestate/properties/units-repository.js";
import { ProjectsRepository } from "@atlas/realestate/properties/projects-repository.js";
import { ReservationsRepository } from "./reservations-repository.js";
import { ContractsRepository, type CreateContractInput, type ContractFilter } from "./contracts-repository.js";
import type { CreateContractBody } from "./contracts.schema.js";

@Injectable()
export class ContractsService {
  constructor(
    private readonly repo: ContractsRepository,
    private readonly reservations: ReservationsRepository,
    private readonly units: UnitsRepository,
    private readonly projects: ProjectsRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(filter: ContractFilter = {}) {
    return readInTenant(() => this.repo.list(filter));
  }

  async get(id: string) {
    const contract = await readInTenant(() => this.repo.findById(id));
    if (!contract) throw NotFound("contract.not_found", "Contract not found.");
    return contract;
  }

  async create(body: CreateContractBody, actorId: string) {
    const input: CreateContractInput = body;
    return this.uow.transaction(async () => {
      const created = await this.repo.create(input);
      await this.audit.record({
        actorId,
        action: "realestate.contract.created",
        resourceType: "realestate_contract",
        resourceId: created.id,
        after: created,
      });
      return created;
    });
  }

  async sign(id: string, actorId: string) {
    return this.uow.transaction(async () => {
      const contract = await this.repo.findById(id);
      if (!contract) throw NotFound("contract.not_found", "Contract not found.");

      const signedDate = this.clock.now().toISOString().slice(0, 10);
      const signed = await this.repo.sign(id, signedDate);

      const unit = await this.units.findById(contract.unitId);
      if (unit) {
        await this.units.updateStatus(unit.id, "sold", { customerId: contract.customerId });
        await this.projects.refreshRollups(unit.projectId);
      }
      if (contract.reservationId) {
        await this.reservations.updateStatus(contract.reservationId, "converted");
      }
      await this.audit.record({
        actorId,
        action: "realestate.contract.signed",
        resourceType: "realestate_contract",
        resourceId: id,
        after: signed,
      });
      return signed!;
    });
  }
}
