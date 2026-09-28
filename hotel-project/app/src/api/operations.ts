import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENDPOINTS, http } from "@/config";
import { roomKeys } from "./rooms";

// ─── housekeeping ───────────────────────────────────────────────────────────

export type TaskStatus = "pending" | "assigned" | "in_progress" | "completed" | "inspected";
export type TaskCommand = "assign" | "start" | "complete" | "inspect";

export interface HousekeepingTask {
  id: string;
  roomId: string;
  roomNumber: string;
  floor: number;
  roomTypeName: string;
  reservationId: string | null;
  kind: "checkout_clean" | "stayover" | "deep_clean";
  status: TaskStatus;
  priority: "low" | "normal" | "high";
  assigneeId: string | null;
  assigneeName: string | null;
  notes: string | null;
  dueDate: string;
  startedAt: string | null;
  completedAt: string | null;
  inspectedAt: string | null;
  commands: TaskCommand[];
}

export function useHousekeepingTasks(params: { mine?: boolean } = {}) {
  return useQuery({
    queryKey: ["housekeeping", params],
    queryFn: async () =>
      (
        await http<{ items: HousekeepingTask[] }>(ENDPOINTS.housekeeping.tasks, {
          query: { board: "true", mine: params.mine ? "true" : undefined },
        })
      ).items,
    refetchInterval: 30_000,
  });
}

export function useTaskAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      command,
      assigneeId,
      notes,
    }: {
      id: string;
      command: TaskCommand;
      assigneeId?: string;
      notes?: string | null;
    }) =>
      http<HousekeepingTask>(ENDPOINTS.housekeeping.action(id, command), {
        method: "POST",
        body:
          command === "assign"
            ? { assigneeId }
            : command === "complete"
              ? { notes: notes ?? null }
              : {},
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["housekeeping"] });
      void qc.invalidateQueries({ queryKey: roomKeys.rooms });
      void qc.invalidateQueries({ queryKey: ["front-desk"] });
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

// ─── maintenance ────────────────────────────────────────────────────────────

export type TicketStatus = "open" | "assigned" | "in_progress" | "resolved" | "verified";
export type TicketCommand = "assign" | "start" | "resolve" | "reopen" | "verify";
export type TicketPriority = "low" | "medium" | "high" | "urgent";
export type RoomImpact = "none" | "maintenance" | "out_of_service";

export interface Ticket {
  id: string;
  number: string;
  roomId: string;
  roomNumber: string;
  roomTypeName: string;
  title: string;
  description: string | null;
  priority: TicketPriority;
  status: TicketStatus;
  assigneeId: string | null;
  assigneeName: string | null;
  cost: number;
  roomImpact: RoomImpact;
  expectedBack: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  commands: TicketCommand[];
}

export interface TicketDetail extends Ticket {
  reportedByName: string | null;
  timeline: Array<{ kind: string; body: string | null; actorName: string; at: string }>;
}

export interface ReportInput {
  roomId: string;
  title: string;
  description: string | null;
  priority: TicketPriority;
  roomImpact: RoomImpact;
  expectedBack: string | null;
}

export function useTickets(params: { open?: boolean; mine?: boolean }) {
  return useQuery({
    queryKey: ["maintenance", params],
    queryFn: async () =>
      (
        await http<{ items: Ticket[] }>(ENDPOINTS.maintenance.tickets, {
          query: { open: params.open ? "true" : undefined, mine: params.mine ? "true" : undefined },
        })
      ).items,
  });
}

export function useTicket(id: string) {
  return useQuery({
    queryKey: ["maintenance", "detail", id],
    queryFn: () => http<TicketDetail>(ENDPOINTS.maintenance.byId(id)),
  });
}

function useInvalidateMaintenance() {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      ["maintenance"],
      roomKeys.rooms,
      ["calendar"],
      ["availability"],
      ["dashboard"],
    ]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
}

export function useReportTicket() {
  const invalidate = useInvalidateMaintenance();
  return useMutation({
    mutationFn: (input: ReportInput) =>
      http<Ticket>(ENDPOINTS.maintenance.tickets, { method: "POST", body: input }),
    onSuccess: invalidate,
  });
}

type TicketAction =
  | { kind: "assign"; assigneeId: string }
  | { kind: "start" }
  | { kind: "resolve"; notes: string | null }
  | { kind: "reopen"; reason: string }
  | { kind: "verify" }
  | { kind: "note"; body: string }
  | { kind: "cost"; cost: number }
  | { kind: "extend"; expectedBack: string };

export function useTicketAction(id: string) {
  const invalidate = useInvalidateMaintenance();
  return useMutation({
    mutationFn: (a: TicketAction) => {
      const e = ENDPOINTS.maintenance;
      switch (a.kind) {
        case "assign":
          return http(e.action(id, "assign"), {
            method: "POST",
            body: { assigneeId: a.assigneeId },
          });
        case "start":
          return http(e.action(id, "start"), { method: "POST" });
        case "resolve":
          return http(e.action(id, "resolve"), { method: "POST", body: { notes: a.notes } });
        case "reopen":
          return http(e.action(id, "reopen"), { method: "POST", body: { reason: a.reason } });
        case "verify":
          return http(e.action(id, "verify"), { method: "POST" });
        case "note":
          return http(e.action(id, "notes"), { method: "POST", body: { body: a.body } });
        case "cost":
          return http(e.action(id, "cost"), { method: "POST", body: { cost: a.cost } });
        case "extend":
          return http(e.action(id, "extend-block"), {
            method: "POST",
            body: { expectedBack: a.expectedBack },
          });
      }
    },
    onSuccess: invalidate,
  });
}

// ─── dashboard ──────────────────────────────────────────────────────────────

export interface Dashboard {
  date: string;
  kpis: {
    occupancyPct: number;
    occupancyDelta: number;
    revenueToday: number;
    revenueDelta: number | null;
    arrivals: { total: number; pending: number };
    departures: { total: number; pending: number };
    availableRooms: number;
    totalRooms: number;
    outstanding: number;
  };
  trend: Array<{ date: string; occupancyPct: number; revenue: number }>;
  roomStatus: Record<string, number>;
  alerts: Array<{
    type: "maintenance" | "housekeeping" | "finance" | "guest";
    text: string;
    href: string | null;
  }>;
  recentReservations: Array<{
    id: string;
    code: string;
    status: string;
    guestName: string;
    roomNumber: string | null;
    arrival: string;
    departure: string;
    total: number;
  }>;
}

export function useDashboard(enabled: boolean) {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: () => http<Dashboard>(ENDPOINTS.dashboard),
    enabled,
    refetchInterval: 60_000,
  });
}
