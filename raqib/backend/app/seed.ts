import { Inject, Injectable } from "@nestjs/common";
import { SeedService } from "@core/bootstrap/seed.service.js";
import { CLOCK, UNIT_OF_WORK } from "@core/kernel/tokens.js";
import type { UnitOfWork } from "@core/kernel/db/db.js";
import type { Clock } from "@core/kernel/clock.js";
import { runAsSystem } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { seedRbacDefinitions } from "@core/rbac/application/seed.js";
import { RbacRepository } from "@core/rbac/infrastructure/rbac-repository.js";
import { RAQIB_ROLES } from "@raqib/raqib/shared/roles.js";
import { TemplateRepository } from "@core/notifications/infrastructure/template-repository.js";
import { RAQIB_TEMPLATES } from "@raqib/raqib/notifications/templates.js";
import { LifecycleService } from "@raqib/raqib/lifecycle/lifecycle-service.js";
import { assertDataKeyConfigured } from "@raqib/raqib/shared/data-key.js";
import { DemoSeeder } from "@raqib/raqib/demo/demo-seeder.js";
import { getConfig } from "@core/kernel/config.js";
import { demoSeedRefusal, readRaqibConfig } from "./config.js";

const log = moduleLogger("raqib-app-seed");

/**
 * Raqib application seed — mirrors `hotel-project/backend/app/seed.ts`. Runs Core's own seed first
 * (Core permissions + the `admin` wildcard role + notification templates), then registers the Raqib
 * roles in Core RBAC (infrastructure permissions only), then (opt-in) the demo organization. Fully
 * idempotent, runs in system context. Called from `main.ts` after migrating.
 */
@Injectable()
export class AppSeedService {
  constructor(
    private readonly coreSeed: SeedService,
    private readonly rbac: RbacRepository,
    private readonly demo: DemoSeeder,
    private readonly lifecycle: LifecycleService,
    private readonly templates: TemplateRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(UNIT_OF_WORK) private readonly uow: UnitOfWork,
  ) {}

  async seed(): Promise<void> {
    assertDataKeyConfigured();
    const refusal = demoSeedRefusal(readRaqibConfig(), getConfig().nodeEnv);
    if (refusal) throw new Error(refusal);
    await this.coreSeed.seed();

    await runAsSystem(() => seedRbacDefinitions(this.rbac, this.uow, { permissions: [], roles: RAQIB_ROLES }));
    log.info({ roles: RAQIB_ROLES.map((r) => r.key) }, "raqib roles seeded");

    await runAsSystem(() => this.uow.transaction(() => this.templates.upsertMany(RAQIB_TEMPLATES)));

    await this.lifecycle.sealLegacy();

    if (readRaqibConfig().seedDemo) {
      await this.demo.seed(this.clock);
    }
  }
}
