import { createTokenStore } from "@auric/web";

/**
 * Plain (non-React) token storage: the http client reads tokens outside of render. Only the refresh
 * token is persisted; the access token is re-derived from it on boot. The mechanism is
 * `@auric/web`'s; Raqib only names its storage key.
 */
export const tokenStore = createTokenStore({ refreshKey: "raqib.refreshToken" });
