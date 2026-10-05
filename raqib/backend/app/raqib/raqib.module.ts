import { Module } from "@nestjs/common";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { PeopleModule } from "@raqib/raqib/people/people.module.js";
import { PermissionsModule } from "@raqib/raqib/permissions/permissions.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { SettingsApiModule } from "@raqib/raqib/settings/settings-api.module.js";
import { VisitsModule } from "@raqib/raqib/visits/visits.module.js";
import { RaqibNotificationsModule } from "@raqib/raqib/notifications/notifications.module.js";
import { JobsModule } from "@raqib/raqib/jobs/jobs.module.js";
import { SharedModule } from "@raqib/raqib/shared/shared.module.js";
import { FormsModule } from "@raqib/raqib/forms/forms.module.js";
import { InspectionsModule } from "@raqib/raqib/inspections/inspections.module.js";
import { EvidenceModule } from "@raqib/raqib/evidence/evidence.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";

/**
 * The Raqib product domain (mirrors `HotelModule` / `RealestateModule`). Composes every Raqib feature
 * module over Core. Each module reaches Core only through its provider contracts and documented
 * services; Raqib behaviour never moves into Core. Architecture: `raqib/docs/architecture.md`.
 */
@Module({
  imports: [SettingsModule, SettingsApiModule, AccessModule, PeopleModule, ProjectsModule, PermissionsModule, SharedModule, VisitsModule, RaqibNotificationsModule, JobsModule, FormsModule, InspectionsModule, EvidenceModule],
})
export class RaqibModule {}
