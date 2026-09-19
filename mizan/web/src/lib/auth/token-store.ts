import { createTokenStore } from "@auric/web";
import type { AccessTokenClaims } from "@/types/auth";

/**
 * Mizan's token store — the mechanism (memory access token, persisted refresh token, safe when
 * storage is unavailable) is `@auric/web`'s; Mizan supplies its storage key and claim shape.
 */
const base = createTokenStore({ refreshKey: "mizan.refresh" });

export const tokenStore = {
  ...base,
  getClaims: (): AccessTokenClaims | null => base.getClaims<AccessTokenClaims>(),
};
