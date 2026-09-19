import { Inject, Injectable } from "@nestjs/common";
import { SeedService } from "@core/bootstrap/seed.service.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { runAsSystem } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { seedRbacDefinitions } from "@core/rbac/application/seed.js";
import { RbacRepository } from "@core/rbac/infrastructure/rbac-repository.js";
import { CLOCK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import { REALESTATE_PERMISSIONS } from "@atlas/realestate/permissions.js";
import { REALESTATE_ROLES } from "@atlas/realestate/shared/roles.js";
import { DemoSeeder } from "@atlas/realestate/demo/demo-seeder.js";

const log = moduleLogger("atlas-app-seed");

/**
 * Atlas application seed — mirrors `mizan/backend/app/seed.ts` exactly. Runs
 * Core's own seed first (Core permissions + the `admin` wildcard role +
 * notification templates), then registers the real-estate domain's
 * permissions and its starting set of global roles. Fully idempotent, runs in
 * system context. Called from `main.ts` after `migrateToLatest`.
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
      seedRbacDefinitions(this.rbac, this.uow, { permissions: REALESTATE_PERMISSIONS, roles: REALESTATE_ROLES }),
    );

    log.info(
      { permissions: REALESTATE_PERMISSIONS.length, roles: REALESTATE_ROLES.map((r) => r.key) },
      "real-estate RBAC seeded",
    );

    if (process.env.ATLAS_SEED_DEMO === "true") {
      await this.demo.seed(this.clock);
    }
  }
}
