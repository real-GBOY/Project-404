import { Module } from "@nestjs/common";

/**
 * The Mizan law-firm product domain (Plan §10.1 `app/<domain>/`).
 *
 * A single Nest module that will compose the feature areas — clients, matters,
 * hearings, tasks, documents, billing, staff, calendar, dashboard, activity,
 * reminders, assistant. Each area follows the standard module anatomy (domain ·
 * application · infrastructure · api · permissions · events · validation ·
 * tests) and talks to Core only through the provider contracts in
 * `core/contracts` (§4).
 *
 * Phase 1.0: the composition root and RBAC seed are wired; feature areas are
 * added phase by phase. Permission definitions already live in each area's
 * `permissions.ts` and are aggregated in `./permissions.ts`.
 */
@Module({
  imports: [],
  providers: [],
  exports: [],
})
export class LawfirmModule {}
