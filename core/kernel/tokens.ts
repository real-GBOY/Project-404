/**
 * Injection tokens for things that have no class to key on — config values,
 * the unit-of-work, and the provider *interfaces* from `core/contracts` (§4).
 * A domain module depends on `IUserProvider`, not the concrete class; Nest
 * needs a runtime token for that, so we bind the interface to one of these.
 */
export const CONFIG = Symbol("auric.config");
export const CLOCK = Symbol("auric.clock");
export const UNIT_OF_WORK = Symbol("auric.unitOfWork");

export const AUDIT_LOGGER = Symbol("auric.auditLogger");
export const EVENT_BUS = Symbol("auric.eventBus");
export const USER_PROVIDER = Symbol("auric.userProvider");
export const ORGANIZATION_PROVIDER = Symbol("auric.organizationProvider");
export const PERMISSION_PROVIDER = Symbol("auric.permissionProvider");
export const NOTIFICATION_PROVIDER = Symbol("auric.notificationProvider");
export const FILE_STORAGE = Symbol("auric.fileStorage");
export const TENANT_CONTEXT = Symbol("auric.tenantContext");
export const EMAIL_CHANNEL = Symbol("auric.emailChannel");
export const PASSWORD_HASHER = Symbol("auric.passwordHasher");
export const ERROR_TRACKER = Symbol("auric.errorTracker");
export const JWT_SERVICE = Symbol("auric.jwtService");
export const STORAGE_ADAPTER = Symbol("auric.storageAdapter");
/** Whether login requires a verified email. `false` for admin-provisioned / tests. */
export const REQUIRE_EMAIL_VERIFICATION = Symbol("auric.requireEmailVerification");
/** Whether the outbox worker starts on app bootstrap. `false` in tests (they drive tick()). */
export const WORKER_AUTOSTART = Symbol("auric.workerAutostart");
