import { Module } from "@nestjs/common";
import { AdmitSharedModule } from "@admit/admit/shared/shared.module.js";
import { AdmitEventsModule } from "@admit/admit/events/events.module.js";

/**
 * The Admit product domain (mirrors `HotelModule` / `RaqibModule`). Composes every Admit feature
 * module over Core. Each module reaches Core only through its provider contracts and documented
 * services; Admit behaviour never moves into Core. Architecture: `admit/docs/architecture.md`.
 */
@Module({
  imports: [AdmitSharedModule, AdmitEventsModule],
})
export class AdmitModule {}
