import { Module } from "@nestjs/common";
import { IdentityModule } from "@core/index.js";
import { ActivityRepository } from "@app/lawfirm/activity/activity-repository.js";
import { ActivityService } from "@app/lawfirm/activity/activity-service.js";
import { LawfirmQueries } from "./lawfirm-queries.js";

/**
 * Shared law-firm infrastructure every feature module depends on: the activity
 * feed (`record()` + read) and the cross-entity aggregate queries (invoice totals,
 * money roll-ups, child counts). It also re-exports `IdentityModule`, which is where
 * Core's `UserDirectory` (aliased locally as `LawfirmDirectory`) is provided.
 */
@Module({
  imports: [IdentityModule],
  providers: [ActivityRepository, ActivityService, LawfirmQueries],
  exports: [IdentityModule, ActivityRepository, ActivityService, LawfirmQueries],
})
export class LawfirmSharedModule {}
