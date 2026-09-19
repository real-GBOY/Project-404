/**
 * The user-name directory (`userId` → display name) is Core's `UserDirectory`. This
 * alias keeps Atlas's existing `RealestateDirectory` import and injection token working
 * unchanged; new code can inject `UserDirectory` directly.
 *
 * Fallback rules ("—" for an unknown id, `null` for no id) are Core's and are shared by
 * every product; anything real-estate-specific about how a name is DISPLAYED belongs here.
 */
export { UserDirectory as RealestateDirectory } from "@core/identity/application/user-directory.js";
