import { createTokenStore } from "@auric/web";

/**
 * Plain (non-React) token storage for the organizer dashboard and scanner: the http client reads tokens outside of render.
 * Only the refresh token is persisted; the access token is re-derived from it on boot. The mechanism is `@auric/web`'s;
 * Admit only names its storage key. Customers never sign in: their booking is reached by a magic-link secret in the URL.
 */
export const tokenStore = createTokenStore({ refreshKey: "admit.refreshToken" });
