import type { RequestHandler } from "msw";
import { sessionHandlers } from "./session";
import { dashboardHandlers } from "./dashboard";
import { clientHandlers } from "./clients";
import { matterHandlers } from "./matters";
import { hearingHandlers } from "./hearings";
import { taskHandlers } from "./tasks";
import { documentHandlers } from "./documents";
import { calendarHandlers } from "./calendar";

/**
 * MSW request handlers, one module per feature. As each backend phase ships,
 * delete that feature's handler file and its entry here — the feature's `api/`
 * functions already target the real route (ARCHITECTURE §8).
 *
 * `session` is a dev shim (F2): auth + notifications are real endpoints, mocked
 * only so the shell runs before F3 and without a local backend.
 */
export const handlers: RequestHandler[] = [
  ...sessionHandlers,
  ...dashboardHandlers,
  ...clientHandlers,
  ...matterHandlers,
  ...hearingHandlers,
  ...taskHandlers,
  ...documentHandlers,
  ...calendarHandlers,
];
