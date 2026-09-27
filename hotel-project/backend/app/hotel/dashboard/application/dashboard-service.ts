import { formatEgp } from "@hotel/hotel/shared/money.js";
import { Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { addDays } from "@hotel/hotel/shared/dates.js";
import { fromPiastres, toPiastres } from "@hotel/hotel/shared/money.js";
import { SettingsService } from "@hotel/hotel/settings/application/settings-service.js";
import { RoomsService } from "@hotel/hotel/rooms/application/rooms-service.js";
import type { RoomDisplayStatus } from "@hotel/hotel/rooms/domain/room-status.js";
import { DashboardRepository } from "../infrastructure/dashboard-repository.js";

const TREND_DAYS = 7;

export type AlertType = "maintenance" | "housekeeping" | "finance" | "guest";

/**
 * "What is happening in the hotel today?" — every figure is computed from the ledgers:
 *   occupancy   = rooms with a stay tonight ÷ rooms in service tonight
 *   revenue     = folio charges posted for that service date (pre-VAT)
 *   outstanding = Σ in-house folio balances
 * Nothing on the dashboard is a stored counter or a placeholder.
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly repo: DashboardRepository,
    private readonly rooms: RoomsService,
    private readonly settings: SettingsService,
  ) {}

  overview() {
    return readInTenant(async () => {
      const today = await this.settings.today();
      const from = addDays(today, -(TREND_DAYS - 1));
      const [series, roomCount, movements, outstanding, recent, alerts, board] = await Promise.all([
        this.repo.dailySeries(from, addDays(today, 1)),
        this.repo.roomCount(),
        this.repo.movements(today),
        this.repo.outstanding(),
        this.repo.recentReservations(6),
        this.repo.alerts(today),
        this.rooms.list(),
      ]);

      const occupancyPct = (occupied: number, blocked: number) => {
        const sellable = roomCount - blocked;
        return sellable > 0 ? Math.round((occupied / sellable) * 1000) / 10 : 0;
      };
      const trend = series.map((d) => ({
        date: d.day,
        occupancyPct: occupancyPct(d.occupied, d.blocked),
        revenue: d.revenue,
      }));
      const todayPoint = trend[trend.length - 1]!;
      const yesterday = trend[trend.length - 2];

      const statusCounts = {} as Record<RoomDisplayStatus, number>;
      for (const s of [
        "available",
        "reserved",
        "occupied",
        "dirty",
        "cleaning",
        "maintenance",
        "out_of_service",
      ] as RoomDisplayStatus[]) {
        statusCounts[s] = 0;
      }
      for (const room of board) statusCounts[room.displayStatus]++;
      const availableTonight = series[series.length - 1]!;

      const alertList: Array<{ type: AlertType; text: string; href: string | null }> = [
        ...alerts.tickets.map((t) => ({
          type: "maintenance" as const,
          text: `Room ${t.room_number}: ${t.title} (${t.priority})`,
          href: `/maintenance/${t.id}`,
        })),
        ...alerts.notReady.map((r) => ({
          type: "housekeeping" as const,
          text: `Room ${r.room_number} is ${r.housekeeping_status} — ${r.guest_name} arrives today`,
          href: "/housekeeping",
        })),
        ...alerts.balances.map((b) => ({
          type: "finance" as const,
          text: `${b.guest_name} (#${b.code}) is due out with ${formatEgp(b.balance)} outstanding`,
          href: `/reservations/${b.id}`,
        })),
        ...alerts.vip.map((v) => ({
          type: "guest" as const,
          text: `VIP arrival: ${v.guest_name}${v.room_number ? ` — Room ${v.room_number}` : ""}`,
          href: `/reservations/${v.id}`,
        })),
      ];

      return {
        date: today,
        kpis: {
          occupancyPct: todayPoint.occupancyPct,
          occupancyDelta: yesterday
            ? Math.round((todayPoint.occupancyPct - yesterday.occupancyPct) * 10) / 10
            : 0,
          revenueToday: todayPoint.revenue,
          revenueDelta:
            yesterday && yesterday.revenue > 0
              ? Math.round(((todayPoint.revenue - yesterday.revenue) / yesterday.revenue) * 1000) /
                10
              : null,
          arrivals: { total: movements.arrivals, pending: movements.arrivals_pending },
          departures: { total: movements.departures, pending: movements.departures_pending },
          availableRooms: Math.max(
            roomCount - availableTonight.occupied - availableTonight.blocked,
            0,
          ),
          totalRooms: roomCount,
          outstanding: fromPiastres(toPiastres(outstanding)),
        },
        trend,
        roomStatus: statusCounts,
        alerts: alertList,
        recentReservations: recent,
      };
    });
  }
}
