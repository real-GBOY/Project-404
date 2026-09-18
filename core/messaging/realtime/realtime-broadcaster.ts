import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";
import type { IRealtimeBroadcaster } from "@core/contracts/index.js";
import { realtimeRooms } from "@core/messaging/contracts/realtime-events.js";

/**
 * The emit-only face of the socket server (`REALTIME_BROADCASTER`). It knows
 * nothing about auth or commands — the gateway attaches the live `Server` — so
 * services and event subscribers can depend on it without a cycle, and without
 * depending on the transport. Before a server is attached (unit tests, workers
 * without an HTTP listener) every call is a harmless no-op.
 */
@Injectable()
export class RealtimeBroadcaster implements IRealtimeBroadcaster {
  private io: Server | undefined;

  attach(io: Server | undefined): void {
    this.io = io;
  }

  toRoom(room: string, event: string, payload: unknown): void {
    this.io?.to(room).emit(event, payload);
  }

  toUser(organizationId: string, userId: string, event: string, payload: unknown): void {
    this.toRoom(realtimeRooms.user(organizationId, userId), event, payload);
  }

  joinUser(organizationId: string, userId: string, room: string): void {
    this.io?.in(realtimeRooms.user(organizationId, userId)).socketsJoin(room);
  }

  leaveUser(organizationId: string, userId: string, room: string): void {
    this.io?.in(realtimeRooms.user(organizationId, userId)).socketsLeave(room);
  }
}
