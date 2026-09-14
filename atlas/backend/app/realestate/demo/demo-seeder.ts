import { Injectable } from "@nestjs/common";
import type { Clock } from "@core/kernel/clock.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";

const log = moduleLogger("atlas-demo-seed");

/**
 * Seeds one demo developer organization with data mirroring
 * `atlas/web/src/mocks/fixtures/*` — env-gated (`ATLAS_SEED_DEMO=true`), runs
 * from `AppSeedService` only. Mirrors Mizan's `DemoSeeder`
 * (`mizan/backend/app/lawfirm/demo/demo-seeder.ts`).
 *
 * Filled in incrementally as each feature module lands — currently a no-op
 * placeholder so the app boots and the seed pipeline is wired end to end.
 */
@Injectable()
export class DemoSeeder {
  async seed(_clock: Clock): Promise<void> {
    log.info("demo seed: not yet implemented for this module set — skipping");
  }
}
