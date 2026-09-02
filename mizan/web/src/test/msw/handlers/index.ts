import type { RequestHandler } from "msw";
import { sessionHandlers } from "./session";
import { dashboardHandlers } from "./dashboard";
import { clientHandlers } from "./clients";
import { matterHandlers } from "./matters";
import { hearingHandlers } from "./hearings";
import { taskHandlers } from "./tasks";
import { documentHandlers } from "./documents";
import { calendarHandlers } from "./calendar";
import { billingHandlers } from "./billing";
import { teamHandlers } from "./team";
import { settingsHandlers } from "./settings";

/**
 * MSW request handlers for the **Vitest** suite only (`src/test/setup.ts`), one
 * module per feature. The running app has no in-browser mock — every screen
 * talks to the real Mizan backend. These handlers are a test double that mirrors
 * the backend's response shapes so component/page tests can assert on rendered
 * data without a live server; keep them in sync with `mizan/backend/app/lawfirm`.
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
  ...billingHandlers,
  ...teamHandlers,
  ...settingsHandlers,
];
