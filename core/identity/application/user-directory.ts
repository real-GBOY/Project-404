import { Inject, Injectable } from "@nestjs/common";
import { USER_PROVIDER } from "@core/kernel/tokens.js";
import type { IUserProvider } from "@core/contracts/index.js";

/** What a directory answers for an id that resolves to no user. */
export const UNKNOWN_USER_NAME = "\u2014"; // "—"

/**
 * Resolves user ids to display names, through the `IUserProvider` contract (never the
 * `users` table). It is the ONE implementation of the lookup that application code needs
 * whenever a screen shows "who did this": read models, activity feeds, message senders.
 *
 * What it does, exactly:
 *  - a name is the user's `displayName`, else their `email`, else `UNKNOWN_USER_NAME`;
 *  - `userName(null | undefined | "")` is `null` — "no user" is not the same as "unknown user";
 *  - `userNames` ignores empty ids, de-duplicates, and resolves each distinct id once (in
 *    parallel — `IUserProvider` has no batch call, so this is one lookup per distinct id).
 *
 * What it deliberately does NOT do: format, localise, abbreviate or style a name. Anything
 * beyond "the best available name for this id" is the application's presentation logic and
 * stays in the application (compose over this, or over `IUserProvider` directly).
 */
@Injectable()
export class UserDirectory {
  constructor(@Inject(USER_PROVIDER) private readonly users: IUserProvider) {}

  async userName(id: string | null | undefined): Promise<string | null> {
    if (!id) return null;
    return this.resolve(id);
  }

  /** Batch resolve; returns a map id → name (unknown ids map to `UNKNOWN_USER_NAME`). */
  async userNames(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
    const entries = await Promise.all(unique.map(async (id) => [id, await this.resolve(id)] as const));
    return new Map(entries);
  }

  private async resolve(id: string): Promise<string> {
    const user = await this.users.getUser(id);
    return user?.displayName ?? user?.email ?? UNKNOWN_USER_NAME;
  }
}
