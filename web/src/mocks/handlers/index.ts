import type { RequestHandler } from "msw";
import { sessionHandlers } from "./session";

/**
 * MSW request handlers, one module per feature. As each backend phase ships,
 * delete that feature's handler file and its entry here — the feature's `api/`
 * functions already target the real route (ARCHITECTURE §8).
 *
 * `session` is a dev shim (F2): auth + notifications are real endpoints, mocked
 * only so the shell runs before F3 and without a local backend.
 */
export const handlers: RequestHandler[] = [...sessionHandlers];
