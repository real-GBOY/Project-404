import { describe, expect, it } from "vitest";
import { demoSeedRefusal, readRaqibConfig } from "./config.js";

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
