import { Global, Injectable, Module, type OnApplicationShutdown } from "@nestjs/common";
import { getConfig } from "./config.js";
import { systemClock } from "./clock.js";
import { closeDb, unitOfWork } from "@core/kernel/db/db.js";
import { closePool } from "@core/kernel/db/pool.js";
import { loggingErrorTracker } from "@core/observability/errors/error-tracker.js";
import { tenantContext } from "./tenant.js";
import { CLOCK, CONFIG, ERROR_TRACKER, TENANT_CONTEXT, UNIT_OF_WORK } from "./tokens.js";

/**
 * Cross-cutting kernel primitives, available everywhere (§3.4). These are
 * process singletons that predate Nest — the module just exposes them to the
 * container so the rest of the codebase can inject rather than import them.
 *
 * `CONFIG` is read once at startup (a bad env fails fast). `CLOCK` and
 * `UNIT_OF_WORK` are overridden per test via `overrideProvider`.
 */
/** Closes the Kysely instances + pg pools on shutdown. */
@Injectable()
class DbLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await closeDb().catch(() => {});
    await closePool().catch(() => {});
  }
}

@Global()
@Module({
  providers: [
    DbLifecycle,
    { provide: CONFIG, useFactory: getConfig },
    { provide: CLOCK, useValue: systemClock },
    { provide: UNIT_OF_WORK, useValue: unitOfWork },
    { provide: ERROR_TRACKER, useValue: loggingErrorTracker },
    { provide: TENANT_CONTEXT, useValue: tenantContext },
  ],
  exports: [CONFIG, CLOCK, UNIT_OF_WORK, ERROR_TRACKER, TENANT_CONTEXT],
})
export class KernelModule {}
