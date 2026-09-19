import { Module } from "@nestjs/common";
import { IdentityModule } from "@core/index.js";

/**
 * Shared real-estate infrastructure every feature module depends on. It re-exports
 * `IdentityModule`, which is where Core's `UserDirectory` (aliased locally as
 * `RealestateDirectory`) is provided. Cross-entity aggregate queries live per-consumer
 * (`finance/finance-queries.ts`, `dashboard/dashboard-service.ts`) rather than
 * one grab-bag class, since Atlas's read-composition needs are spread across
 * more distinct aggregates than Mizan's single `LawfirmQueries`.
 */
@Module({
  imports: [IdentityModule],
  exports: [IdentityModule],
})
export class RealestateSharedModule {}
