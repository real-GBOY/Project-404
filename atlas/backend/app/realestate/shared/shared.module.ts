import { Module } from "@nestjs/common";
import { IdentityModule } from "@core/index.js";
import { RealestateDirectory } from "./directory.js";

/**
 * Shared real-estate infrastructure every feature module depends on: the
 * user-name directory. Cross-entity aggregate queries live per-consumer
 * (`finance/finance-queries.ts`, `dashboard/dashboard-service.ts`) rather than
 * one grab-bag class, since Atlas's read-composition needs are spread across
 * more distinct aggregates than Mizan's single `LawfirmQueries`.
 */
@Module({
  imports: [IdentityModule],
  providers: [RealestateDirectory],
  exports: [RealestateDirectory],
})
export class RealestateSharedModule {}
