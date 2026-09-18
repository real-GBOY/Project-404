import { Module, type OnModuleInit } from "@nestjs/common";
import { MESSAGING_PROVIDER, REALTIME_BROADCASTER } from "@core/kernel/tokens.js";
import { AuditModule } from "@core/audit/audit.module.js";
import { EventsModule } from "@core/events/events.module.js";
import { EventRegistry } from "@core/events/registry.js";
import { FilesModule } from "@core/files/files.module.js";
import { IdentityModule } from "@core/identity/identity.module.js";
import { OrganizationsModule } from "@core/organizations/organizations.module.js";
import { RbacModule } from "@core/rbac/rbac.module.js";
import { MessagingController } from "@core/messaging/api/messaging.controller.js";
import { MessagingService } from "@core/messaging/application/messaging-service.js";
import { MessagingRepository } from "@core/messaging/infrastructure/messaging-repository.js";
import { registerMessagingBroadcast } from "@core/messaging/realtime/broadcast-subscribers.js";
import { RealtimeBroadcaster } from "@core/messaging/realtime/realtime-broadcaster.js";
import { RealtimeGateway } from "@core/messaging/realtime/realtime-gateway.js";

/**
 * AURIC Core Messaging (core/messaging/README.md, docs/messaging.md) — generic,
 * real-time conversations. Nothing here knows about any product domain: a
 * product attaches meaning via `subjectType`/`subjectId` + `metadata`, and reads
 * conversations through `MESSAGING_PROVIDER` (membership-checked).
 *
 * Realtime: `RealtimeGateway` (Socket.IO on the app's own HTTP server) handles
 * commands; committed domain events reach sockets through the transactional
 * outbox (`registerMessagingBroadcast`). `REALTIME_BROADCASTER` is exported so a
 * product can emit its own namespaced events to the same authorized rooms.
 */
@Module({
  imports: [EventsModule, AuditModule, IdentityModule, OrganizationsModule, RbacModule, FilesModule],
  controllers: [MessagingController],
  providers: [
    MessagingRepository,
    MessagingService,
    RealtimeBroadcaster,
    RealtimeGateway,
    { provide: MESSAGING_PROVIDER, useExisting: MessagingService },
    { provide: REALTIME_BROADCASTER, useExisting: RealtimeBroadcaster },
  ],
  exports: [MESSAGING_PROVIDER, REALTIME_BROADCASTER, MessagingService],
})
export class MessagingModule implements OnModuleInit {
  constructor(
    private readonly registry: EventRegistry,
    private readonly broadcaster: RealtimeBroadcaster,
    private readonly messaging: MessagingService,
  ) {}

  onModuleInit(): void {
    registerMessagingBroadcast(this.registry, this.broadcaster, this.messaging);
  }
}
