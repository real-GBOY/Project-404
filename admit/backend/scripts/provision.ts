import "reflect-metadata";
import { randomBytes } from "node:crypto";
import { parseArgs } from "node:util";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "@admit/app.module.js";
import { AppSeedService } from "@admit/seed.js";
import { ProvisioningService } from "@admit/admit/staff/application/provisioning-service.js";
import { migrateToLatest } from "./migrate.js";

/**
 * Onboard a real organizer (no demo data):
 *
 *   npm run provision -- --name "Nile Sessions Events" --slug nile-sessions --owner-email owner@example.com --owner-name "Salma Adel"
 *
 * Creates the organization, its first owner account and the owner role, then prints the owner's first password ONCE (a random one unless
 * you pass --owner-password). Run it on the server with the owner database URL after the API's first start (or pass --migrate). It
 * refuses an existing slug or e-mail before creating anything.
 *
 * Lock-out recovery (an owner forgot their password and no other owner can reset it):
 *
 *   npm run provision -- --reset-owner owner@example.com
 */
const { values } = parseArgs({
  options: {
    name: { type: "string" },
    slug: { type: "string" },
    "owner-email": { type: "string" },
    "owner-name": { type: "string" },
    "owner-password": { type: "string" },
    "reset-owner": { type: "string" },
    migrate: { type: "boolean", default: false },
  },
});

const reset = values["reset-owner"];
if (!reset) {
  for (const k of ["name", "owner-email", "owner-name"] as const) {
    if (!values[k]) {
      console.error(`Missing --${k}. See scripts/provision.ts for usage.`);
      process.exit(2);
    }
  }
}

// a strong, typeable password: 4 groups of letters and digits without look-alikes
const generated = () => {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(16);
  const group = (o: number) => Array.from({ length: 4 }, (_, i) => alphabet[bytes[o + i]! % alphabet.length]).join("");
  return [group(0), group(4), group(8), group(12)].join("-");
};

if (values.migrate) await migrateToLatest();
const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
try {
  await app.get(AppSeedService).seed(); // roles and permissions (idempotent)
  const svc = app.get(ProvisioningService);
  const password = values["owner-password"] ?? generated();
  if (reset) {
    await svc.resetOwnerPassword(reset, password);
    console.log(`Password for ${reset} set to: ${password}\nThey should change it after signing in.`);
  } else {
    const r = await svc.provision({
      name: values.name!,
      ...(values.slug ? { slug: values.slug } : {}),
      ownerEmail: values["owner-email"]!,
      ownerName: values["owner-name"]!,
      ownerPassword: password,
    });
    console.log(JSON.stringify(r, null, 2));
    console.log(
      `\nPublic site:  /e/${r.slug}\nSign in at /admin as ${r.ownerEmail}\nFirst password (shown once): ${password}\nThe owner should change it after signing in.`,
    );
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await app.close();
}
