import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "@raqib/app.module.js";
import { CLOCK } from "@core/kernel/tokens.js";
import { DemoSeeder } from "@raqib/raqib/demo/demo-seeder.js";
import { readRaqibConfig } from "@raqib/config.js";

/**
 * Bring an already seeded DEMO organization up to date without resetting it (see `DemoSeeder.upgradeExisting`):
 *   npm run demo:upgrade            # add what is missing, then check consistency
 *   npm run demo:upgrade -- --check # only check
 * It refuses to run unless demo mode is allowed for this process, and never touches another organization.
 */
const checkOnly = process.argv.includes("--check");
const cfg = readRaqibConfig();
if (process.env.NODE_ENV === "production" && !cfg.allowDemoInProduction) {
  console.error("Refusing: this is a production process without RAQIB_ALLOW_DEMO_IN_PRODUCTION.");
  process.exit(2);
}
const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
try {
  const seeder = app.get(DemoSeeder);
  if (!checkOnly) {
    for (const line of await seeder.upgradeExisting(app.get(CLOCK))) console.log(`• ${line}`);
    console.log("");
  }
  const { ok, lines } = await seeder.verifyDemo();
  for (const l of lines) console.log(l);
  console.log(ok ? "\nConsistent." : "\nInconsistencies found.");
  process.exitCode = ok ? 0 : 1;
} finally {
  await app.close();
}
