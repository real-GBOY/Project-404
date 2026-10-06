import { describe, expect, it } from "vitest";
import { demoSeedRefusal, readRaqibConfig, resolvePdfDriver } from "./config.js";

describe("the demo company and production", () => {
  const cfg = (env: Record<string, string>) => readRaqibConfig(env as NodeJS.ProcessEnv);

  it("is refused in production by default, so it can never land next to real data", () => {
    expect(demoSeedRefusal(cfg({ RAQIB_SEED_DEMO: "true" }), "production")).toMatch(/refused in production/);
  });

  it("is allowed in production only with the explicit second key", () => {
    expect(demoSeedRefusal(cfg({ RAQIB_SEED_DEMO: "true", RAQIB_ALLOW_DEMO_IN_PRODUCTION: "true" }), "production")).toBeNull();
    // the second key alone seeds nothing
    expect(demoSeedRefusal(cfg({ RAQIB_ALLOW_DEMO_IN_PRODUCTION: "true" }), "production")).toBeNull();
  });

  it("never gets in the way outside production, or when the demo is off", () => {
    expect(demoSeedRefusal(cfg({ RAQIB_SEED_DEMO: "true" }), "development")).toBeNull();
    expect(demoSeedRefusal(cfg({}), "production")).toBeNull();
  });
});

describe("which PDF driver a process uses", () => {
  const driver = (env: Record<string, string>) => resolvePdfDriver(readRaqibConfig(env as NodeJS.ProcessEnv));
  const CF = { RAQIB_CF_ACCOUNT_ID: "acc", RAQIB_CF_API_TOKEN: "tok" };

  it("is none until something is configured", () => {
    expect(driver({})).toBeNull();
    expect(driver({ RAQIB_CF_ACCOUNT_ID: "acc" })).toBeNull(); // a token is needed too
  });

  it("prefers a local Chromium, and falls back to Cloudflare Browser Rendering", () => {
    expect(driver({ RAQIB_CHROMIUM_PATH: "/usr/bin/chromium" })).toBe("chromium");
    expect(driver(CF)).toBe("cloudflare");
    expect(driver({ ...CF, RAQIB_CHROMIUM_PATH: "/usr/bin/chromium" })).toBe("chromium");
  });

  it("can be forced, and a forced driver that is not configured gives none", () => {
    expect(driver({ ...CF, RAQIB_CHROMIUM_PATH: "/usr/bin/chromium", RAQIB_PDF_DRIVER: "cloudflare" })).toBe("cloudflare");
    expect(driver({ RAQIB_PDF_DRIVER: "cloudflare", RAQIB_CHROMIUM_PATH: "/usr/bin/chromium" })).toBeNull();
    expect(driver({ RAQIB_PDF_DRIVER: "chromium", ...CF })).toBeNull();
  });
});
