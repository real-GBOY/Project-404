import type { RequestHandler } from "msw";

/**
 * MSW request handlers, one module per feature. As each backend phase ships,
 * delete that feature's handler file and its entry here — the feature's `api/`
 * functions already target the real route (ARCHITECTURE §8).
 */
export const handlers: RequestHandler[] = [
  // ...featureHandlers (added per phase)
];
