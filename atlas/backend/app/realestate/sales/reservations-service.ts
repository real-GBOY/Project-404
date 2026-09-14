import { Inject, Injectable } from "@nestjs/common";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { readInTenant } from "@core/kernel/db/db.js";
import { Conflict, NotFound } from "@core/kernel/errors.js";
import { AUDIT_LOGGER, CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import type { IAuditLogger } from "@core/contracts/index.js";
import { UnitsRepository } from "@atlas/realestate/properties/units-repository.js";
import { ProjectsRepository } from "@atlas/realestate/properties/projects-repository.js";
import { CustomersRepository } from "@atlas/realestate/crm/customers-repository.js";
import { ReservationsRepository, type CreateReservationInput, type ReservationStatus } from "./reservations-repository.js";
import type { CreateReservationBody } from "./reservations.schema.js";

@Injectable()
export class ReservationsService {
  constructor(
    private readonly repo: ReservationsRepository,
    private readonly units: UnitsRepository,
    private readonly projects: ProjectsRepository,
    private readonly customers: CustomersRepository,
    @Inject(AUDIT_LOGGER) private readonly audit: IAuditLogger,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  list(status?: ReservationStatus) {
    return readInTenant(() => this.repo.list(status));
  }

  async get(id: string) {
    const reservation = await readInTenant(() => this.repo.findById(id));
    if (!reservation) throw NotFound("reservation.not_found", "Reservation not found.");
    return reservation;
  }

  async create(body: CreateReservationBody, actorId: string) {
    return this.uow.transaction(async () => {
      const unit = await this.units.findById(body.unitId);
      if (!unit) throw NotFound("unit.not_found", "Unit not found.");
      if (unit.status !== "available") throw Conflict("unit.not_available", "Only an available unit can be reserved.");

      const customer = await this.customers.findById(body.customerId);
      if (!customer) throw NotFound("customer.not_found", "Customer not found.");

      const expiresAt = new Date(this.clock.now().getTime() + body.holdDays * 24 * 60 * 60 * 1000);
      const input: CreateReservationInput = {
        unitId: body.unitId,
        customerId: body.customerId,
        agentId: body.agentId,
        expiresAt: expiresAt.toISOString(),
        depositEgp: body.depositEgp,
      };
      const created = await this.repo.create(input);
      await this.units.updateStatus(unit.id, "reserved", { customerId: body.customerId, agentId: body.agentId });
      await this.customers.linkUnit(body.customerId, unit.id);
      await this.projects.refreshRollups(unit.projectId);
      await this.audit.record({
        actorId,
        action: "realestate.reservation.created",
        resourceType: "realestate_reservation",
        resourceId: created.id,
        after: created,
      });
      return created;
    });
  }

  async cancel(id: string, actorId: string) {
    return this.uow.transaction(async () => {
      const reservation = await this.repo.findById(id);
      if (!reservation) throw NotFound("reservation.not_found", "Reservation not found.");
      const updated = await this.repo.updateStatus(id, "expired");
      const unit = await this.units.findById(reservation.unitId);
      if (unit) {
        await this.units.updateStatus(unit.id, "available", { customerId: null, agentId: null });
        await this.projects.refreshRollups(unit.projectId);
      }
      await this.audit.record({
        actorId,
        action: "realestate.reservation.cancelled",
        resourceType: "realestate_reservation",
        resourceId: id,
      });
      return updated!;
    });
  }
}
