import { Module } from "@nestjs/common";
import { HotelSharedModule } from "@hotel/hotel/shared/shared.module.js";

/**
 * The HotelOS product domain (mirrors `atlas/backend/app/realestate/realestate.module.ts`).
 * Composes every hotel feature module over the shared infrastructure. Each module reaches Core
 * only through the provider contracts in `core/contracts` and the documented Core services;
 * hotel-specific behaviour never moves into Core. Architecture: `docs/architecture.md`.
 */
@Module({
  imports: [HotelSharedModule],
})
export class HotelModule {}
