import { Module } from "@nestjs/common";
import { EventsModule, IdentityModule, NotificationsModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { RaqibNotifications } from "./raqib-notifications.js";

/** Staff notifications for Raqib events (see RaqibNotifications). Delivery is Core's. */
@Module({
  imports: [EventsModule, IdentityModule, NotificationsModule, AccessModule, ProjectsModule, SettingsModule, VisitsModule],
  providers: [RaqibNotifications],
})
export class RaqibNotificationsModule {}
