import { Global, Module } from "@nestjs/common";
import { getConfig } from "./config.js";
import { systemClock } from "./clock.js";
import { unitOfWork } from "./db/db.js";
import { loggingErrorTracker } from "../observability/errors/error-tracker.js";
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
@Global()
@Module({
  providers: [
    { provide: CONFIG, useFactory: getConfig },
    { provide: CLOCK, useValue: systemClock },
    { provide: UNIT_OF_WORK, useValue: unitOfWork },
    { provide: ERROR_TRACKER, useValue: loggingErrorTracker },
    { provide: TENANT_CONTEXT, useValue: tenantContext },
  ],
  exports: [CONFIG, CLOCK, UNIT_OF_WORK, ERROR_TRACKER, TENANT_CONTEXT],
})
export class KernelModule {}
