import { Module } from "@nestjs/common";
import { RbacModule } from "../../../../../core/index.js";
import { DemoSeeder } from "./demo-seeder.js";

/**
 * The opt-in demo seeder. Wired into `AppModule` so `AppSeedService` can run it
 * when `MIZAN_SEED_DEMO === "true"`.
 */
@Module({
  imports: [RbacModule],
  providers: [DemoSeeder],
  exports: [DemoSeeder],
})
export class DemoModule {}
