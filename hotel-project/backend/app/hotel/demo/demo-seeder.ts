import { Injectable } from "@nestjs/common";
import { currentExecutor, unitOfWork } from "@core/kernel/db/db.js";
import { newId } from "@core/kernel/id.js";
import { runAsSystem } from "@core/kernel/logging/context.js";
import { moduleLogger } from "@core/kernel/logging/logger.js";
import { argon2Hasher } from "@core/identity/infrastructure/password-hasher.js";
import { RbacService } from "@core/rbac/application/rbac-service.js";
import type { Clock } from "@core/kernel/clock.js";
import { DEMO_ORG, DEMO_PASSWORD, DEMO_STAFF } from "./demo-data.js";

const log = moduleLogger("hotel-demo-seed");

/**
 * Opt-in demo dataset (`HOTEL_SEED_DEMO=true`, run from `AppSeedService` only). Idempotent: skips
 * entirely if the demo organization already exists. Mirrors
 * `atlas/backend/app/realestate/demo/demo-seeder.ts`: staff accounts are inserted directly with
 * a pre-verified email (the demo must be one click from signed-in), then roles go through Core
 * RBAC. Hotel data is created through the hotel domain services as those modules land — never by
 * raw inserts that would skip their invariants.
 */
@Injectable()
export class DemoSeeder {
  constructor(private readonly rbac: RbacService) {}

  async seed(clock: Clock): Promise<void> {
    const already = await runAsSystem(() =>
      currentExecutor()
        .selectFrom("organizations")
        .select("id")
        .where("slug", "=", DEMO_ORG.slug)
        .executeTakeFirst(),
    );
    if (already) {
      log.info("demo hotel already present — skipping");
      return;
    }

    const now = clock.now();
    const orgId = newId("org");
    const userIds = new Map<string, string>();
    const passwordHash = await argon2Hasher.hash(DEMO_PASSWORD);

    await runAsSystem(() =>
      unitOfWork.transaction(async () => {
        const ex = currentExecutor();
        for (const s of DEMO_STAFF) {
          const id = newId("usr");
          userIds.set(s.key, id);
          await ex
            .insertInto("users")
            .values({
              id,
              email: s.email,
              email_normalized: s.email.toLowerCase(),
              password_hash: passwordHash,
              display_name: s.name,
              status: "active",
              email_verified_at: now,
              locale: "en",
            })
            .execute();
        }
        await ex
          .insertInto("organizations")
          .values({ id: orgId, name: DEMO_ORG.name, slug: DEMO_ORG.slug, settings: {} })
          .execute();
        for (const s of DEMO_STAFF) {
          await ex
            .insertInto("organization_members")
            .values({
              id: newId("mem"),
              organization_id: orgId,
              user_id: userIds.get(s.key)!,
              membership_role: s.membershipRole,
            })
            .execute();
        }
      }),
    );

    const ownerId = userIds.get(DEMO_STAFF[0]!.key)!;
    for (const s of DEMO_STAFF) {
      await runAsSystem(() => this.rbac.assignRole(userIds.get(s.key)!, s.roleKey, ownerId, orgId));
    }

    log.info({ org: DEMO_ORG.slug, staff: DEMO_STAFF.length }, "demo hotel seeded");
  }
}
