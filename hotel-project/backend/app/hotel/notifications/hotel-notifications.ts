import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { DomainEvent } from "@core/contracts/domain-event.js";
import type { INotificationProvider } from "@core/contracts/index.js";
import { EventRegistry } from "@core/events/registry.js";
import { UserDirectory } from "@core/identity/application/user-directory.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import { permissionMatches } from "@core/rbac/domain/permission.js";
import { currentExecutor } from "@core/kernel/db/db.js";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { NOTIFICATION_PROVIDER } from "@core/kernel/tokens.js";
import { formatEgp } from "@hotel/hotel/shared/money.js";
import { HousekeepingRepository } from "@hotel/hotel/housekeeping/infrastructure/housekeeping-repository.js";
import { MaintenanceRepository } from "@hotel/hotel/maintenance/infrastructure/maintenance-repository.js";
import { ReservationsRepository } from "@hotel/hotel/reservations/infrastructure/reservations-repository.js";
import { BillingRepository } from "@hotel/hotel/billing/infrastructure/billing-repository.js";

const KIND_LABEL: Record<string, string> = {
  checkout_clean: "Check-out clean",
  stayover: "Stayover service",
  deep_clean: "Deep clean",
};

type Payload = Record<string, unknown>;

/**
 * Who hears about what. Each rule reacts to a domain event IN-PROCESS — inside the transaction
 * that caused it — and writes in-app notifications through Core's provider, so a notification
 * exists exactly when its cause committed. Recipients are chosen by permission (never by role
 * key), and nobody is notified about their own action.
 *
 *   housekeeping.task_assigned   → the housekeeper
 *   maintenance.ticket_assigned  → the technician
 *   maintenance.ticket_reported  → maintenance supervisors, if urgent/high or it blocks the room
 *   maintenance.ticket_resolved  → maintenance supervisors (to verify)
 *   payment.failed / refund.failed → finance staff
 *   reservation.no_show / .cancelled by the SYSTEM (scheduled jobs) → the front desk
 */
@Injectable()
export class HotelNotifications implements OnModuleInit {
  constructor(
    private readonly registry: EventRegistry,
    @Inject(NOTIFICATION_PROVIDER) private readonly notify: INotificationProvider,
    private readonly rbac: RbacService,
    private readonly directory: UserDirectory,
    private readonly housekeeping: HousekeepingRepository,
    private readonly maintenance: MaintenanceRepository,
    private readonly reservations: ReservationsRepository,
    private readonly billing: BillingRepository,
  ) {}

  onModuleInit(): void {
    const on = (name: string, handler: (p: Payload) => Promise<void>) =>
      this.registry.onInProcess(name, (e: DomainEvent) => handler(e.payload as Payload));
    on("housekeeping.task_assigned", (p) => this.taskAssigned(p));
    on("maintenance.ticket_assigned", (p) => this.ticketAssigned(p));
    on("maintenance.ticket_reported", (p) => this.ticketReported(p));
    on("maintenance.ticket_resolved", (p) => this.ticketResolved(p));
    on("payment.failed", (p) => this.moneyFailed("Payment", p));
    on("refund.failed", (p) => this.moneyFailed("Refund", p));
    on("reservation.no_show", (p) => this.systemTransition(p, "marked as a no-show"));
    on("reservation.cancelled", (p) => this.systemTransition(p, "released — hold expired"));
  }

  // ─── rules ────────────────────────────────────────────────────────────────

  private async taskAssigned(p: Payload) {
    const task = await this.housekeeping.findById(String(p.taskId));
    if (!task || p.assigneeId === p.actorId) return;
    await this.send([String(p.assigneeId)], {
      templateKey: "hotel.housekeeping_assigned",
      type: "hotel.housekeeping_assigned",
      data: {
        room: task.roomNumber,
        kind: KIND_LABEL[task.kind] ?? task.kind,
        actor: await this.name(p.actorId),
        href: "/housekeeping",
      },
    });
  }

  private async ticketAssigned(p: Payload) {
    const t = await this.maintenance.findById(String(p.ticketId));
    if (!t || p.assigneeId === p.actorId) return;
    await this.send([String(p.assigneeId)], {
      templateKey: "hotel.maintenance_assigned",
      type: "hotel.maintenance_assigned",
      data: {
        number: t.number,
        room: t.roomNumber,
        title: t.title,
        priority: t.priority,
        href: `/maintenance/${t.id}`,
      },
    });
  }

  private async ticketReported(p: Payload) {
    const urgent = p.priority === "urgent" || p.priority === "high" || p.roomImpact !== "none";
    if (!urgent) return;
    const t = await this.maintenance.findById(String(p.ticketId));
    if (!t) return;
    const impact =
      t.roomImpact === "none"
        ? ""
        : ` — room ${t.roomImpact === "out_of_service" ? "out of service" : "under maintenance"}${
            t.expectedBack ? ` until ${t.expectedBack}` : ""
          }`;
    await this.send(await this.holders("manage", "maintenance", p.actorId), {
      templateKey: "hotel.maintenance_reported",
      type: "hotel.maintenance_reported",
      data: {
        number: t.number,
        room: t.roomNumber,
        title: t.title,
        priority: t.priority,
        impact,
        href: `/maintenance/${t.id}`,
      },
    });
  }

  private async ticketResolved(p: Payload) {
    const t = await this.maintenance.findById(String(p.ticketId));
    if (!t) return;
    await this.send(await this.holders("manage", "maintenance", p.actorId), {
      templateKey: "hotel.maintenance_resolved",
      type: "hotel.maintenance_resolved",
      data: {
        number: t.number,
        room: t.roomNumber,
        title: t.title,
        actor: await this.name(p.actorId),
        href: `/maintenance/${t.id}`,
      },
    });
  }

  private async moneyFailed(what: "Payment" | "Refund", p: Payload) {
    const r = await this.reservations.findById(String(p.reservationId));
    if (!r) return;
    const row =
      what === "Payment"
        ? await this.billing.paymentById(String(p.paymentId))
        : await this.billing.refundById(String(p.refundId));
    await this.send(await this.holders("read", "payment"), {
      templateKey: "hotel.money_failed",
      type: "hotel.money_failed",
      data: {
        what,
        code: r.code,
        guest: r.guestName,
        amount: formatEgp(Number(p.amount)),
        reason: row?.failureReason ? `Reason: ${row.failureReason}.` : "",
        href: `/reservations/${r.id}`,
      },
    });
  }

  /** Only changes made by the scheduled jobs — people see their own changes on screen. */
  private async systemTransition(p: Payload, what: string) {
    if (p.actorId) return;
    const r = await this.reservations.findById(String(p.reservationId));
    if (!r) return;
    await this.send(await this.holders("check_in", "reservation"), {
      templateKey: "hotel.reservation_auto",
      type: "hotel.reservation_auto",
      data: {
        code: r.code,
        what,
        guest: r.guestName,
        reason: r.cancellationReason ?? "by the overnight check",
        href: `/reservations/${r.id}`,
      },
    });
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  private async send(
    userIds: string[],
    n: { templateKey: string; type: string; data: Record<string, string> },
  ): Promise<void> {
    for (const userId of new Set(userIds)) {
      await this.notify.send({ userId, channels: ["in_app"], ...n });
    }
  }

  private async name(userId: unknown): Promise<string> {
    if (typeof userId !== "string") return "the system";
    return (await this.directory.userNames([userId])).get(userId) ?? "a colleague";
  }

  /** Members of this hotel holding a permission (checked live), minus whoever caused the event. */
  private async holders(action: string, resource: string, except?: unknown): Promise<string[]> {
    const org = requireOrganizationId();
    const members = await currentExecutor()
      .selectFrom("organization_members")
      .select("user_id")
      .where("organization_id", "=", org)
      .execute();
    const out: string[] = [];
    for (const { user_id } of members) {
      if (user_id === except) continue;
      const held = await this.rbac.permissionsForUser(user_id, org);
      if (held.some((k) => permissionMatches(k, action, resource))) out.push(user_id);
    }
    return out;
  }
}
