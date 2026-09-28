import { Module } from "@nestjs/common";
import { AuditModule, IdentityModule } from "@core/index.js";
import { ActivityController } from "./api/activity.controller.js";
import { ActivityService } from "./application/activity-service.js";
import { ActivityLabels } from "./infrastructure/activity-labels.js";

@Module({
  imports: [AuditModule, IdentityModule],
  controllers: [ActivityController],
  providers: [ActivityLabels, ActivityService],
})
export class ActivityModule {}
