import "reflect-metadata";
import { parseArgs } from "node:util";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "@raqib/app.module.js";
import { AppSeedService } from "@raqib/seed.js";
import { ProvisioningService } from "@raqib/raqib/provisioning/provisioning-service.js";
import { migrateToLatest } from "./migrate.js";

/**
 * Onboard a customer:
 *   npm run provision -- --name "Acme Security" --slug acme --owner-email ceo@acme.example --owner-name "Sara Ali"
 *
 * Creates the organization, its first administrator (default role: quality manager, or --owner-role gm), default
 * settings and the starter forms, then prints the one-time link the owner uses to choose a password. Run it with the
 * owner database URL after `npm run migrate` (or pass --migrate). It never touches demo data and refuses an existing
 * slug or e-mail.
 */
const { values } = parseArgs({
  options: {
    name: { type: "string" },
    "name-ar": { type: "string" },
    slug: { type: "string" },
    "owner-email": { type: "string" },
    "owner-name": { type: "string" },
    "owner-name-ar": { type: "string" },
    "owner-role": { type: "string", default: "qm" },
    city: { type: "string" },
    "no-starter-forms": { type: "boolean", default: false },
    migrate: { type: "boolean", default: false },
  },
});

for (const k of ["name", "slug", "owner-email", "owner-name"] as const) {
  if (!values[k]) {
    console.error(`Missing --${k}. See scripts/provision.ts for usage.`);
    process.exit(2);
  }
}
if (values["owner-role"] !== "qm" && values["owner-role"] !== "gm") {
  console.error("--owner-role must be qm or gm.");
  process.exit(2);
}

if (values.migrate) await migrateToLatest();
const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
try {
  await app.get(AppSeedService).seed(); // roles + permission templates (idempotent)
  const r = await app.get(ProvisioningService).provision({
    name: values.name!,
    ...(values["name-ar"] ? { nameAr: values["name-ar"] } : {}),
    slug: values.slug!,
    ownerEmail: values["owner-email"]!,
    ownerName: values["owner-name"]!,
    ...(values["owner-name-ar"] ? { ownerNameAr: values["owner-name-ar"] } : {}),
    ownerRole: values["owner-role"] as "qm" | "gm",
    ...(values.city ? { city: { ar: values.city, en: values.city } } : {}),
    starterForms: !values["no-starter-forms"],
  });
  console.log(JSON.stringify(r, null, 2));
  console.log("\nGive the owner the setupLink above (valid 7 days, single use).");
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await app.close();
}
