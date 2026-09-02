import { Module } from "@nestjs/common";
import { IdentityModule } from "@core/index.js";
import { ActivityRepository } from "@app/lawfirm/activity/activity-repository.js";
import { ActivityService } from "@app/lawfirm/activity/activity-service.js";
import { LawfirmDirectory } from "./directory.js";
import { LawfirmQueries } from "./lawfirm-queries.js";

/**
 * Shared law-firm infrastructure every feature module depends on: the activity
 * feed (`record()` + read), the user-name directory, and the cross-entity
 * aggregate queries (invoice totals, money roll-ups, child counts).
 */
@Module({
  imports: [IdentityModule],
  providers: [ActivityRepository, ActivityService, LawfirmDirectory, LawfirmQueries],
  exports: [ActivityRepository, ActivityService, LawfirmDirectory, LawfirmQueries],
})
export class LawfirmSharedModule {}
