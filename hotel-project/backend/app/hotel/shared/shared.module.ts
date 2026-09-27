import { Module } from "@nestjs/common";
import { IdentityModule } from "@core/index.js";

/**
 * Shared hotel infrastructure every feature module depends on. Re-exports `IdentityModule`,
 * which provides Core's `UserDirectory` (staff names for assignees, audit actors, …) —
 * the same shape as `RealestateSharedModule`.
 */
@Module({
  imports: [IdentityModule],
  exports: [IdentityModule],
})
export class HotelSharedModule {}
