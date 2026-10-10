import { defineConfig } from "@playwright/test";

/**
 * Browser end-to-end tests: the BUILT web app in a real Chrome, talking to the REAL backend on a throw-away database seeded with the
 * demo organizer (Nile Sessions Events). Nothing is mocked.
 *
 *   npm run e2e
 *
 * Needs PostgreSQL on localhost (override with ADMIT_E2E_PG_ADMIN) and Google Chrome (or set PLAYWRIGHT_CHANNEL). The backend runs on
 * :3499, the web app on :4799.
 */
const API = process.env.ADMIT_E2E_API ?? "http://localhost:3499";
const WEB = process.env.ADMIT_E2E_WEB ?? "http://localhost:4799";
const DB = process.env.ADMIT_E2E_DB ?? "admit_e2e";
const DB_URL = (process.env.ADMIT_E2E_PG_ADMIN ?? "postgres://postgres:postgres@localhost:5432/postgres").replace(/\/[^/]*$/, `/${DB}`);

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1, // one shared database: specs run one after another
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: WEB, channel: process.env.PLAYWRIGHT_CHANNEL ?? "chrome", trace: "retain-on-failure", screenshot: "only-on-failure", locale: "en-US", permissions: [] },
  webServer: [
    {
      command: "node scripts/e2e-db.mjs && node --import @swc-node/register/esm-register main.ts",
      cwd: "../backend",
      url: `${API}/api/health/ready`,
      timeout: 240_000,
      reuseExistingServer: !!process.env.ADMIT_E2E_REUSE,
      env: {
        NODE_ENV: "development",
        AURIC_PORT: "3499",
        AURIC_DATABASE_URL: DB_URL,
        AURIC_JWT_SECRET: "e2e-secret-e2e-secret-e2e-secret-123456",
        AURIC_APP_URL: WEB,
        AURIC_FILE_STORAGE_DRIVER: "local",
        AURIC_FILE_STORAGE_PATH: "./storage/e2e",
        AURIC_LOG_LEVEL: "warn",
        ADMIT_SEED_DEMO: "true",
        ADMIT_TRUSTED_PROXY_HOPS: "1",
        ADMIT_PUBLIC_URL: WEB,
        ADMIT_API_URL: API,
      },
    },
    {
      command: "npm run build && npx vite preview",
      url: WEB,
      timeout: 240_000,
      reuseExistingServer: !!process.env.ADMIT_E2E_REUSE,
      env: { VITE_DEMO: "true", ADMIT_API_PROXY_TARGET: API },
    },
  ],
});
