import { Module } from "@nestjs/common";
import { AUDIT_LOGGER } from "@core/kernel/tokens.js";
import { AuditRepository } from "@core/audit/infrastructure/audit-repository.js";
import { AuditLogger } from "@core/audit/infrastructure/audit-logger.js";
import { AuditController } from "@core/audit/api/audit.controller.js";

/**
 * Audit (§7.7) — append-only trail. `AUDIT_LOGGER` is the `IAuditLogger` every
 * use case records through, inside its own transaction.
 */
@Module({
  controllers: [AuditController],
  providers: [
    AuditRepository,
    AuditLogger,
    { provide: AUDIT_LOGGER, useExisting: AuditLogger },
  ],
  exports: [AUDIT_LOGGER, AuditRepository],
})
export class AuditModule {}
