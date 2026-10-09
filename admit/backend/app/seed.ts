import { Inject, Injectable } from "@nestjs/common";
import { SeedService } from "@core/bootstrap/seed.service.js";
import { UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import { getConfig } from "@core/kernel/config.js";
import { runAsSystem } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { seedRbacDefinitions } from "@core/rbac/application/seed.js";
import { RbacRepository } from "@core/rbac/infrastructure/rbac-repository.js";
import { ADMIT_PERMISSIONS } from "@admit/admit/permissions.js";
import { ADMIT_ROLES } from "@admit/admit/shared/roles.js";
import { DemoSeeder } from "@admit/admit/demo/demo-seeder.js";
import { CLOCK } from "@core/kernel/tokens.js";
import type { Clock } from "@core/kernel/clock.js";
import { assertTicketKeyConfigured } from "@admit/admit/shared/secrets.js";
import { demoSeedRefusal, readAdmitConfig } from "./config.js";

const log = moduleLogger("admit-app-seed");

/**
 * Admit application seed - mirrors `hotel-project/backend/app/seed.ts`. Runs Core's own seed first
 * (Core permissions + the `admin` wildcard role + notification templates), then registers the Admit
 * permissions and its starting set of global roles. Fully idempotent, runs in system context. Called
 * from `main.ts` after migrating.
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
    assertTicketKeyConfigured();
    const refusal = demoSeedRefusal(readAdmitConfig(), getConfig().nodeEnv);
    if (refusal) throw new Error(refusal);
    await this.coreSeed.seed();

    await runAsSystem(() => seedRbacDefinitions(this.rbac, this.uow, { permissions: ADMIT_PERMISSIONS, roles: ADMIT_ROLES }));
    log.info({ permissions: ADMIT_PERMISSIONS.length, roles: ADMIT_ROLES.map((r) => r.key) }, "admit RBAC seeded");

    if (readAdmitConfig().seedDemo) await this.demo.seed(this.clock);
  }
}
