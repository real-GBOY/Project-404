import { Module } from "@nestjs/common";
import { EventsModule, IdentityModule, NotificationsModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { ActionsModule } from "@raqib/raqib/actions/actions.module.js";
import { TrainingModule } from "@raqib/raqib/training/training.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { RaqibNotifications } from "./raqib-notifications.js";

/** Staff notifications for Raqib events (see RaqibNotifications). Delivery is Core's. */
@Module({
  imports: [EventsModule, IdentityModule, NotificationsModule, AccessModule, ProjectsModule, SettingsModule, VisitsModule, ActionsModule, TrainingModule],
  providers: [RaqibNotifications],
})
export class RaqibNotificationsModule {}
