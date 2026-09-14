import { Inject, Injectable } from "@nestjs/common";
import { USER_PROVIDER } from "@core/kernel/tokens.js";
import type { IUserProvider } from "@core/contracts/index.js";

/**
 * Resolves Core user ids to display names for denormalised fields the web
 * contract expects (agent/assignee/uploaded-by names). Mirrors Mizan's
 * `lawfirm/shared/directory.ts` — an unknown id renders as `"—"`, a null id
 * as `null`.
 */
@Injectable()
export class RealestateDirectory {
  constructor(@Inject(USER_PROVIDER) private readonly users: IUserProvider) {}

  async userName(id: string | null | undefined): Promise<string | null> {
    if (!id) return null;
    const user = await this.users.getUser(id);
    return user?.displayName ?? user?.email ?? "—";
  }

  async userNames(ids: Array<string | null | undefined>): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
    const entries = await Promise.all(
      unique.map(async (id) => {
        const user = await this.users.getUser(id);
        return [id, user?.displayName ?? user?.email ?? "—"] as const;
      }),
    );
    return new Map(entries);
  }
}
