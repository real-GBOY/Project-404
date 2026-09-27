import { Injectable } from "@nestjs/common";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { AppError } from "@core/kernel/errors.js";
import { runAsOf } from "@hotel/hotel/shared/business-date.js";
import { addDays, type IsoDate } from "@hotel/hotel/shared/dates.js";
import { ReservationsService } from "@hotel/hotel/reservations/application/reservations-service.js";
import type { ReservationSource } from "@hotel/hotel/reservations/infrastructure/reservations-repository.js";
import { FrontDeskService } from "@hotel/hotel/front-desk/application/front-desk-service.js";
import { BillingService } from "@hotel/hotel/billing/application/billing-service.js";
import type { PaymentMethod } from "@hotel/hotel/billing/domain/payment-provider.js";
import { HousekeepingService } from "@hotel/hotel/housekeeping/application/housekeeping-service.js";

const log = moduleLogger("hotel-demo-history");

/** Small deterministic PRNG (mulberry32) — the same demo every time. */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface HistoryContext {
  ownerId: string;
  receptionistIds: string[];
  housekeeperIds: string[];
  guestIds: string[];
  roomTypeIds: string[];
  today: IsoDate;
  days: number;
}

interface OpenStay {
  id: string;
  roomId: string | null;
  departure: IsoDate;
  method: PaymentMethod;
  prepaid: boolean;
}

const SOURCES: ReservationSource[] = [
  "website",
  "booking_com",
  "phone",
  "expedia",
  "direct",
  "walk_in",
];
const METHODS: PaymentMethod[] = ["card", "card", "cash", "online", "bank_transfer"];
const CANCEL_REASONS = [
  "Flight cancelled.",
  "Change of travel plans.",
  "Found a closer hotel to the venue.",
  "Family emergency.",
  "Booked twice by mistake.",
];

/**
 * Plays the hotel's recent past through the REAL workflows, one business day at a time
 * (`runAsOf`): guests book and arrive, are checked in (room nights posted), order breakfast or
 * use the minibar, pay, and leave (invoice issued, room dirty, cleaning task opened); housekeepers
 * then clean the rooms. Nothing is inserted behind the domain's back, so every invariant, audit
 * entry and event in the demo is genuine. The simulation stops at today: stays that straddle today
 * are in house, stays due out today are still to check out, and this morning's rooms are dirty.
 */
@Injectable()
export class DemoHistory {
  constructor(
    private readonly reservations: ReservationsService,
    private readonly desk: FrontDeskService,
    private readonly billing: BillingService,
    private readonly housekeeping: HousekeepingService,
  ) {}

  /**
   * A booking for `day` that never becomes a stay: cancelled (with a reason, some time before) or
   * marked no-show on the day. Both go through the reservation state machine.
   */
  private async lostBooking(
    ctx: HistoryContext,
    day: IsoDate,
    outcome: "cancel" | "no_show",
    pick: <T>(xs: T[]) => T,
    rand: () => number,
  ): Promise<void> {
    const clerk = pick(ctx.receptionistIds);
    try {
      const r = await runAsOf(addDays(day, -(1 + Math.floor(rand() * 10))), () =>
        this.reservations.create(
          {
            guestId: pick(ctx.guestIds),
            roomTypeId: pick(ctx.roomTypeIds),
            arrival: day,
            departure: addDays(day, 1 + Math.floor(rand() * 3)),
            adults: 2,
            children: 0,
            source: pick(SOURCES),
            confirm: true,
          },
          clerk,
        ),
      );
      if (outcome === "cancel") {
        await this.reservations.cancel(r.id, pick(CANCEL_REASONS), clerk);
      } else {
        await this.reservations.noShow(r.id, clerk);
      }
    } catch (err) {
      if (!(err instanceof AppError)) throw err;
    }
  }

  async play(ctx: HistoryContext): Promise<{ stays: number }> {
    const rand = prng(20261001);
    const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)]!;
    const open: OpenStay[] = [];
    let stays = 0;
    let keySeq = 0;
    const key = () => `demo-history-${++keySeq}`;

    for (let offset = ctx.days; offset >= 1; offset--) {
      const day = addDays(ctx.today, -offset);
      await runAsOf(day, async () => {
        // 1. Morning: departures check out and settle; housekeepers turn the rooms.
        for (const stay of open.filter((s) => s.departure === day)) {
          const folio = await this.billing.folio(stay.id);
          const out = await this.desk.checkOut(
            stay.id,
            folio.totals.balance > 0
              ? {
                  payment: {
                    method: stay.method,
                    amount: folio.totals.balance,
                    idempotencyKey: key(),
                  },
                }
              : {},
            pick(ctx.receptionistIds),
          );
          const cleaner = pick(ctx.housekeeperIds);
          await this.housekeeping.assign(out.housekeepingTaskId, cleaner, ctx.ownerId);
          await this.housekeeping.start(out.housekeepingTaskId, cleaner);
          await this.housekeeping.complete(out.housekeepingTaskId, null, cleaner);
          if (rand() < 0.6) await this.housekeeping.inspect(out.housekeepingTaskId, ctx.ownerId);
          open.splice(open.indexOf(stay), 1);
        }

        // 2. Bookings that don't happen: some guests cancel ahead of the day, a few never show.
        if (rand() < 0.35) await this.lostBooking(ctx, day, "cancel", pick, rand);
        if (rand() < 0.12) await this.lostBooking(ctx, day, "no_show", pick, rand);

        // 3. Afternoon: today's arrivals book (or walk in) and are checked in. Thursday and Friday
        //    nights (the Egyptian weekend) are busier.
        const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
        const arrivals = 7 + Math.floor(rand() * 5) + (weekday === 4 || weekday === 5 ? 4 : 0);
        for (let i = 0; i < arrivals; i++) {
          const nights = 1 + Math.floor(rand() * 4);
          const clerk = pick(ctx.receptionistIds);
          try {
            const r = await this.reservations.create(
              {
                guestId: pick(ctx.guestIds),
                roomTypeId: pick(ctx.roomTypeIds),
                arrival: day,
                departure: addDays(day, nights),
                adults: rand() < 0.7 ? 2 : 1,
                children: 0,
                source: pick(SOURCES),
                confirm: true,
                discountCode: rand() < 0.15 ? "NILE10" : null,
              },
              clerk,
            );
            await this.desk.checkIn(r.id, {}, clerk);
            const method = pick(METHODS);
            const prepaid = rand() < 0.35;
            if (prepaid) {
              const folio = await this.billing.folio(r.id);
              await this.billing.collectPayment(
                r.id,
                { method, amount: folio.totals.balance, idempotencyKey: key() },
                clerk,
              );
            }
            if (rand() < 0.5) {
              await this.billing.postCharge(
                r.id,
                {
                  kind: "breakfast",
                  description: "Breakfast buffet",
                  quantity: nights * 2,
                  unitPrice: 350,
                },
                clerk,
              );
            }
            if (rand() < 0.25) {
              await this.billing.postCharge(
                r.id,
                {
                  kind: "minibar",
                  description: "Minibar",
                  quantity: 1,
                  unitPrice: 180 + Math.floor(rand() * 6) * 40,
                },
                clerk,
              );
            }
            open.push({
              id: r.id,
              roomId: r.roomId,
              departure: addDays(day, nights),
              method,
              prepaid,
            });
            stays++;
          } catch (err) {
            // A sold-out type or a room not yet turned is a normal day at a hotel — skip it.
            if (!(err instanceof AppError)) throw err;
          }
        }
      });
    }

    // This morning: most of today's departures have already left and housekeeping is part-way
    // through turning their rooms — some done (and inspected), some being cleaned, some assigned,
    // some not yet picked up. The rest (at least three) are still at the desk. Stayover service is
    // due on some occupied rooms too. Rooms move through the stages in turn, so every column of
    // the board has work whatever the random draw.
    const STAGES = ["done", "cleaning", "waiting", "assigned", "inspected", "cleaning"] as const;
    let turned = 0;
    const turnover = async (task: string) => {
      const stage = STAGES[turned++ % STAGES.length]!;
      const cleaner = pick(ctx.housekeeperIds);
      if (stage === "waiting") return;
      await this.housekeeping.assign(task, cleaner, ctx.ownerId);
      if (stage === "assigned") return;
      await this.housekeeping.start(task, cleaner);
      if (stage === "cleaning") return;
      await this.housekeeping.complete(task, null, cleaner);
      if (stage === "inspected") await this.housekeeping.inspect(task, ctx.ownerId);
    };
    await runAsOf(ctx.today, async () => {
      const leaving = open.filter((s) => s.departure === ctx.today);
      const stillAtDesk = Math.max(3, Math.ceil(leaving.length * 0.35));
      for (const stay of leaving.slice(stillAtDesk)) {
        const folio = await this.billing.folio(stay.id);
        const out = await this.desk.checkOut(
          stay.id,
          folio.totals.balance > 0
            ? {
                payment: {
                  method: stay.method,
                  amount: folio.totals.balance,
                  idempotencyKey: key(),
                },
              }
            : {},
          pick(ctx.receptionistIds),
        );
        await turnover(out.housekeepingTaskId);
        open.splice(open.indexOf(stay), 1);
      }
      // Stayover service for guests staying on (not those leaving today), at every stage.
      for (const stay of open) {
        if (!stay.roomId || stay.departure === ctx.today || rand() < 0.5) continue;
        const { id: task } = await this.housekeeping.create(
          { roomId: stay.roomId, kind: "stayover", priority: "low", notes: null },
          ctx.ownerId,
        );
        await turnover(task);
      }
    });

    // Guests still in house today with nothing paid yet leave a deposit on half the stays, so the
    // desk shows a realistic mix of paid, partial and unpaid folios.
    await runAsOf(ctx.today, async () => {
      for (const stay of open.filter((s) => !s.prepaid)) {
        if (rand() < 0.5) continue;
        const folio = await this.billing.folio(stay.id);
        const deposit = Math.round(folio.totals.balance * 0.4);
        if (deposit > 0) {
          await this.billing.collectPayment(
            stay.id,
            { method: stay.method, amount: deposit, idempotencyKey: key() },
            ctx.ownerId,
          );
        }
      }
    });

    log.info({ stays, inHouse: open.length }, "demo history played");
    return { stays };
  }
}
