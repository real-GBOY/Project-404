import type { IAuditLogger, AuditEntry } from "../../contracts/index.js";
import { moduleLogger } from "../../kernel/logging/logger.js";
import type { AuditRepository } from "./audit-repository.js";

const log = moduleLogger("audit");

/**
 * IAuditLogger implementation (§4). Use cases call `record()` inside their
 * transaction, so the audit row commits or rolls back with the change it
 * describes (§3.4 step 5).
 */
export class AuditLogger implements IAuditLogger {
  constructor(private readonly repo: AuditRepository) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.repo.append(entry);
    log.debug(
      { action: entry.action, resourceType: entry.resourceType, resourceId: entry.resourceId },
      "audit recorded",
    );
  }
}
