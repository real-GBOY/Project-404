import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests drive the real stack: the HotelOS backend (hotel-project/backend) on a
 * throwaway `hotel_e2e` database, migrated from zero and seeded with the Hotel Nayel demo on
 * every run, plus the Vite dev server proxying `/api` to it. Nothing is mocked.
 *
 * Needs a local Postgres (override with HOTEL_E2E_DATABASE_URL) and, once per machine,
 * `npm run e2e:install` for the Chromium binary.
 */
const API_PORT = 3292;
const APP_PORT = 4692;
/** The public Hotel Nayel website (hotel-project/web), booking against the same backend. */
export const WEB_PORT = 4592;
const DATABASE_URL =
  process.env.HOTEL_E2E_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/hotel_e2e";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "node e2e/reset-db.mjs && npm --prefix ../backend run serve",
      url: `http://localhost:${API_PORT}/api/health`,
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
      env: {
        NODE_ENV: "development",
        AURIC_PORT: String(API_PORT),
        AURIC_LOG_LEVEL: "warn",
        AURIC_DATABASE_URL: DATABASE_URL,
        AURIC_JWT_SECRET: "e2e-only-secret",
        HOTEL_SEED_DEMO: "true",
        // Enough history for the 30-night analytics without a two-minute boot.
        HOTEL_DEMO_HISTORY_DAYS: "45",
      },
    },
    {
      command: "npx vite",
      url: `http://localhost:${APP_PORT}`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        HOTEL_APP_PORT: String(APP_PORT),
        HOTEL_API_PROXY_TARGET: `http://localhost:${API_PORT}`,
        VITE_DEMO_EMAIL: "",
        VITE_DEMO_PASSWORD: "",
      },
    },
    {
      command: `npm --prefix ../web run dev -- --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: { HOTEL_API_PROXY_TARGET: `http://localhost:${API_PORT}` },
    },
  ],
});
