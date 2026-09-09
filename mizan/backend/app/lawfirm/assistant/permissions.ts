import type { PermissionDefinition } from "@app/lawfirm/shared/rbac.js";

/**
 * The single gate on *reaching* the Copilot. Everything the Copilot then does is
 * gated again, per tool, by the caller's existing law-firm permissions
 * (`read:matter`, `create:task`, …) — so this key only decides whether the
 * assistant surface is available to a role at all, letting a firm switch it off.
 */
export const assistantPermissions: PermissionDefinition[] = [
  { action: "use", resource: "assistant", description: "Use the Mizan Copilot assistant" },
];
