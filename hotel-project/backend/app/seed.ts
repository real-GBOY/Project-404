import { Inject, Injectable } from "@nestjs/common";
import { SeedService } from "@core/bootstrap/seed.service.js";
import { CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import type { Clock } from "@core/kernel/clock.js";
import { runAsSystem } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { seedRbacDefinitions } from "@core/rbac/application/seed.js";
import { RbacRepository } from "@core/rbac/infrastructure/rbac-repository.js";
import { HOTEL_PERMISSIONS } from "@hotel/hotel/permissions.js";
import { HOTEL_ROLES } from "@hotel/hotel/shared/roles.js";
import { DemoSeeder } from "@hotel/hotel/demo/demo-seeder.js";
import { readHotelConfig } from "./config.js";

const log = moduleLogger("hotel-app-seed");

/**
 * HotelOS application seed — mirrors `atlas/backend/app/seed.ts`. Runs Core's own seed first
 * (Core permissions + the `admin` wildcard role + notification templates), then registers the
 * hotel domain's permissions and its starting set of global roles, then (opt-in) the demo
 * property. Fully idempotent, runs in system context. Called from `main.ts` after migrating.
 */
@Injectable()
export class AppSeedService {
  constructor(
    private readonly coreSeed: SeedService,
    private readonly rbac: RbacRepository,
    private readonly demo: DemoSeeder,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async seed(): Promise<void> {
    await this.coreSeed.seed();

    await runAsSystem(() =>
      seedRbacDefinitions(this.rbac, this.uow, {
        permissions: HOTEL_PERMISSIONS,
        roles: HOTEL_ROLES,
      }),
    );
    log.info(
      { permissions: HOTEL_PERMISSIONS.length, roles: HOTEL_ROLES.map((r) => r.key) },
      "hotel RBAC seeded",
    );

    if (readHotelConfig().seedDemo) {
      await this.demo.seed(this.clock);
    }
  }
}
