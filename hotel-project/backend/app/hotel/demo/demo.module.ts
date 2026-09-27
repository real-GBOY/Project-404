import { Module } from "@nestjs/common";
import { RbacModule } from "@core/index.js";
import { DemoSeeder } from "./demo-seeder.js";

/** Hosts the opt-in demo seeder; imports whichever modules the seeder drives. */
@Module({
  imports: [RbacModule],
  providers: [DemoSeeder],
  exports: [DemoSeeder],
})
export class DemoModule {}
