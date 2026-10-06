import { defineConfig } from "@playwright/test";

/**
 * Browser end-to-end tests: the BUILT web app (with its service worker) in a real Chrome, talking to the REAL backend
 * on a throw-away database seeded with the demo organization. Nothing is mocked.
 *
 *   npm run e2e
 *
 * Needs PostgreSQL on localhost (override with RAQIB_E2E_PG_ADMIN) and Google Chrome (or set PLAYWRIGHT_CHANNEL / install
 * Playwright's own browser and drop the channel). The backend runs on :3399, the web app on :4599.
 */
// E2E_WEB + E2E_API aim the suite at an already running deployment (for example production) instead of starting local servers.
// Only run the specs that are safe against shared demo data there (see docs/raqib-deployment.md); never the sign-in lockout specs.
const REMOTE = !!process.env.E2E_WEB;
const API = process.env.E2E_API ?? "http://localhost:3399";
const WEB = process.env.E2E_WEB ?? "http://localhost:4599";
const DB = process.env.RAQIB_E2E_DB ?? "raqib_e2e";
const DB_URL = (
  process.env.RAQIB_E2E_PG_ADMIN ?? "postgres://postgres:postgres@localhost:5432/postgres"
).replace(/\/[^/]*$/, `/${DB}`);

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // one shared database: tests run one after another
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: WEB,
    channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "en-US",
    serviceWorkers: "allow",
  },
  webServer: REMOTE
    ? []
    : [
        {
          command:
            "node scripts/e2e-db.mjs && node --import @swc-node/register/esm-register main.ts",
          cwd: "../backend",
          url: `${API}/api/health/ready`,
          timeout: 240_000,
          reuseExistingServer: !!process.env.RAQIB_E2E_REUSE,
          env: {
            NODE_ENV: "development",
            AURIC_PORT: "3399",
            AURIC_DATABASE_URL: DB_URL,
            AURIC_JWT_SECRET: "e2e-secret-e2e-secret-e2e-secret-123456",
            AURIC_APP_URL: WEB,
            AURIC_FILE_STORAGE_DRIVER: "local",
            AURIC_FILE_STORAGE_PATH: "./storage/e2e",
            AURIC_LOG_LEVEL: "warn",
            RAQIB_SEED_DEMO: "true",
            RAQIB_DEMO_HISTORY_DAYS: "14",
            RAQIB_ENFORCE_ACCOUNT_POLICY: "false",
            RAQIB_TRUSTED_PROXY_HOPS: "1",
          },
        },
        {
          command: "npm run build && npx vite preview",
          url: WEB,
          timeout: 240_000,
          reuseExistingServer: !!process.env.RAQIB_E2E_REUSE,
          env: { VITE_DEMO: "true", RAQIB_API_PROXY_TARGET: API },
        },
      ],
});
