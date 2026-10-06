import { Module } from "@nestjs/common";
import { AuditModule } from "@core/index.js";
import { AccessModule } from "@raqib/raqib/access/access.module.js";
import { PeopleModule } from "@raqib/raqib/people/people.module.js";
import { ProjectsModule } from "@raqib/raqib/projects/projects.module.js";
import { SharedModule } from "@raqib/raqib/shared/shared.module.js";
import { OnboardingController } from "./api/onboarding.controller.js";
import { PublicOnboardingController } from "./api/public-onboarding.controller.js";
import { OnboardingService } from "./application/onboarding-service.js";
import { OnboardingRepository } from "./infrastructure/onboarding-repository.js";

@Module({
  imports: [AuditModule, AccessModule, PeopleModule, ProjectsModule, SharedModule],
  controllers: [OnboardingController, PublicOnboardingController],
  providers: [OnboardingRepository, OnboardingService],
  exports: [OnboardingService],
})
export class OnboardingModule {}
