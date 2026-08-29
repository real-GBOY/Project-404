import type { Migration } from "kysely/migration";

/**
 * The ordered migration manifest. Each module owns its migration files
 * (§3.2 `migrations/`); this manifest is the one place their order is
 * declared. A static list (rather than filesystem scanning) keeps the runner
 * working identically under tsx, vitest, and a bundled build.
 *
 * Order matters for cross-module foreign keys: `identity.users` must exist
 * before `rbac`, `organizations`, and `notifications` reference it. `audit`
 * and `files` deliberately keep no FK to users, so their position is free.
 */
import * as bootstrap001 from "./bootstrap/001_extensions_and_triggers.js";

import * as audit001 from "../../audit/migrations/001_audit_logs.js";

import * as outbox001 from "../../events/outbox/migrations/001_outbox.js";
import * as outbox002 from "../../events/outbox/migrations/002_dead_letter.js";

import * as files001 from "../../files/migrations/001_files.js";

import * as identity001 from "../../identity/migrations/001_users.js";
import * as identity002 from "../../identity/migrations/002_refresh_tokens.js";
import * as identity003 from "../../identity/migrations/003_verification_tokens.js";

import * as notifications001 from "../../notifications/migrations/001_notifications.js";
import * as notifications002 from "../../notifications/migrations/002_templates.js";

import * as organizations001 from "../../organizations/migrations/001_organizations.js";

import * as rbac001 from "../../rbac/migrations/001_rbac.js";

export const MIGRATIONS: Record<string, Migration> = {
  "0000_bootstrap/001_extensions_and_triggers": bootstrap001,
  "audit/001_audit_logs": audit001,
  "events-outbox/001_outbox": outbox001,
  "events-outbox/002_dead_letter": outbox002,
  "files/001_files": files001,
  "identity/001_users": identity001,
  "identity/002_refresh_tokens": identity002,
  "identity/003_verification_tokens": identity003,
  "notifications/001_notifications": notifications001,
  "notifications/002_templates": notifications002,
  "organizations/001_organizations": organizations001,
  "rbac/001_rbac": rbac001,
};
