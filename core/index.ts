/**
 * AURIC Core public surface. A client project imports the feature `@Module`s it
 * needs into its own `AppModule`, and injects the Core contracts by token.
 * See docs/integration-guide.md.
 */
export { AppModule } from "./app.module.js";
export { CORE_VERSION } from "./version.js";

export { KernelModule } from "@core/kernel/kernel.module.js";
export { EventsModule } from "@core/events/events.module.js";
export { AuditModule } from "@core/audit/audit.module.js";
export { RbacModule } from "@core/rbac/rbac.module.js";
export { IdentityModule } from "@core/identity/identity.module.js";
export { OrganizationsModule } from "@core/organizations/organizations.module.js";
export { NotificationsModule } from "@core/notifications/notifications.module.js";
export { FilesModule } from "@core/files/files.module.js";
export { MessagingModule } from "@core/messaging/messaging.module.js";
export { SecurityModule } from "@core/http/security.module.js";
export { SeedService } from "@core/bootstrap/seed.service.js";
export { migrateToLatest, migrationStatus } from "@core/kernel/db/migrate.js";

// RBAC contracts + the generic seeding mechanism. Applications own their permissions,
// roles and any role metadata; Core owns only the shapes and the seeding.
export type { PermissionDefinition } from "@core/rbac/domain/permission.js";
export { parsePermissionKey, permissionKey, permKey } from "@core/rbac/domain/permission.js";
export type { RoleSeed } from "@core/rbac/domain/role.js";
export { seedRbacDefinitions } from "@core/rbac/application/seed.js";
export { getConfig, setConfigForTests, type AuricConfig } from "@core/kernel/config.js";

export * from "@core/kernel/tokens.js";
export type * from "@core/contracts/index.js";
export {
  currentOrganizationId,
  requireOrganizationId,
  isSystemContext,
  tenantContext,
} from "@core/kernel/tenant.js";

// AI Copilot infrastructure (core/assistant/README.md) — generic classes and
// types only; each product supplies its own tools, prompt, and scope
// vocabulary via the tokens above.
export type {
  AiChatRequest,
  AiChatResponse,
  AiClient,
  AiMessage,
  AiToolCall,
  AiToolDef,
  AiUsage,
} from "@core/assistant/domain/ai-client.js";
export { AiUpstreamError } from "@core/assistant/domain/ai-client.js";
export type { AssistantConfig } from "@core/assistant/domain/assistant-config.js";
export { assistantConfigFromAuricConfig } from "@core/assistant/domain/assistant-config.js";
export type {
  AssistantDomainConfig,
  SystemPromptContext,
} from "@core/assistant/domain/assistant-domain.js";
export type { ScopeGuardConfig } from "@core/assistant/domain/scope-guard-config.js";
export type { AssistantTool, ToolContext, ToolResult } from "@core/assistant/domain/tool.js";
export { OpenAiCompatibleClient } from "@core/assistant/infrastructure/openai-compatible-client.js";
export {
  ConversationRepository,
  type AppendMessageInput,
  type ConversationRow,
  type MessageRow,
  type StoredRole,
  type StoredToolCall,
} from "@core/assistant/infrastructure/conversation-repository.js";
export { guardResponse, type GuardedResponse } from "@core/assistant/application/response-guard.js";
export { ScopeGuard, type ScopeDecision } from "@core/assistant/application/scope-guard.js";
export { ToolRegistry } from "@core/assistant/application/tool-registry.js";
export { zodToJsonSchema } from "@core/assistant/application/zod-to-json-schema.js";
export {
  AssistantService,
  type ChatInput,
  type ChatResult,
  type ToolActivity,
} from "@core/assistant/application/assistant-service.js";

// Messaging (core/messaging/README.md) — generic real-time conversations. Wire
// types and the realtime event contract are type-only/const modules the web can share.
export type * from "@core/messaging/contracts/messaging-types.js";
export * from "@core/messaging/contracts/realtime-events.js";
export { MessagingDomainEvents } from "@core/messaging/events/events.js";
export type {
  ConversationCreatedEvent,
  ConversationUpdatedEvent,
  MemberAddedEvent,
  MemberRemovedEvent,
  MessageCreatedEvent,
  MessageDeletedEvent,
  MessageUpdatedEvent,
} from "@core/messaging/events/events.js";
export { messagingPermissions } from "@core/messaging/permissions/permissions.js";
