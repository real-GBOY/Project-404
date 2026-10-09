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
import { ActionsModule } from "@raqib/raqib/actions/actions.module.js";
import { ObservationsModule } from "@raqib/raqib/observations/observations.module.js";
import { TrainingModule } from "@raqib/raqib/training/training.module.js";
import { AnalyticsModule } from "@raqib/raqib/analytics/analytics.module.js";
import { SearchModule } from "@raqib/raqib/search/search.module.js";
import { ConfidentialModule } from "@raqib/raqib/confidential/confidential.module.js";
import { AuditViewModule } from "@raqib/raqib/audit/audit-view.module.js";
import { OnboardingModule } from "@raqib/raqib/onboarding/onboarding.module.js";
import { ReportsModule } from "@raqib/raqib/reports/reports.module.js";
import { ReviewModule } from "@raqib/raqib/review/review.module.js";
import { AccountModule } from "@raqib/raqib/account/account.module.js";
import { SettingsModule } from "@raqib/raqib/settings/settings.module.js";
import { CorrectionsModule } from "@raqib/raqib/corrections/corrections.module.js";
import { ScoringModule } from "@raqib/raqib/scoring/scoring.module.js";
import { SurveysModule } from "@raqib/raqib/surveys/surveys.module.js";
import { ProvisioningModule } from "@raqib/raqib/provisioning/provisioning.module.js";

/**
 * The Raqib product domain (mirrors `HotelModule` / `RealestateModule`). Composes every Raqib feature
 * module over Core. Each module reaches Core only through its provider contracts and documented
 * services; Raqib behaviour never moves into Core. Architecture: `raqib/docs/architecture.md`.
 */
@Module({
  imports: [
    AccountModule,
    SettingsModule,
    SettingsApiModule,
    AccessModule,
    PeopleModule,
    ProjectsModule,
    PermissionsModule,
    SharedModule,
    VisitsModule,
    RaqibNotificationsModule,
    JobsModule,
    FormsModule,
    ScoringModule,
    CorrectionsModule,
    SurveysModule,
    InspectionsModule,
    EvidenceModule,
    ReviewModule,
    ReportsModule,
    ObservationsModule,
    ActionsModule,
    TrainingModule,
    AnalyticsModule,
    SearchModule,
    ConfidentialModule,
    AuditViewModule,
    OnboardingModule,
    ProvisioningModule,
  ],
})
export class RaqibModule {}
