import { getDb } from "@core/kernel/db/db.js";

/**
 * Organization id -> public slug, for building customer links. Read on the SYSTEM connection (not the caller's transaction)
 * because a guest checkout and the scheduled jobs have no organization membership, so tenant RLS would hide the row. Slugs
 * almost never change, so the answer is cached for a few minutes.
 */
const TTL_MS = 5 * 60_000;
const cache = new Map<string, { slug: string; at: number }>();

export async function organizationSlug(organizationId: string): Promise<string> {
  const hit = cache.get(organizationId);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.slug;
  const row = await getDb("system").selectFrom("organizations").select("slug").where("id", "=", organizationId).executeTakeFirstOrThrow();
  cache.set(organizationId, { slug: row.slug, at: Date.now() });
  return row.slug;
}
