import { Module } from "@nestjs/common";
import { IdentityModule } from "@core/index.js";

/**
 * Shared Admit infrastructure every feature module depends on. Re-exports `IdentityModule`, which
 * provides Core's `UserDirectory` (staff names for reviewers and audit actors) - the same shape as
 * `HotelSharedModule`.
 */
@Module({
  imports: [IdentityModule],
  exports: [IdentityModule],
})
export class AdmitSharedModule {}
