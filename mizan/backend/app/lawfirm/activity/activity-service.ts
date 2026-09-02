import { Injectable } from "@nestjs/common";
import { readInTenant } from "@core/kernel/db/db.js";
import { LawfirmDirectory } from "@app/lawfirm/shared/directory.js";
import {
  ActivityRepository,
  type ActivityEntry,
  type RecordActivityInput,
} from "./activity-repository.js";

/** The `{ id, actor, action, target, at }` row the web activity lists render. */
export interface ActivityRow {
  id: string;
  actor: string;
  action: string;
  target: string;
  at: string;
}

@Injectable()
export class ActivityService {
  constructor(
    private readonly repo: ActivityRepository,
    private readonly directory: LawfirmDirectory,
  ) {}

  /** Write an entry — call inside the caller's transaction. */
  record(input: RecordActivityInput): Promise<void> {
    return this.repo.record(input);
  }

  async forTargets(targets: Array<{ type: string; id: string }>): Promise<ActivityRow[]> {
    const entries = await readInTenant(() => this.repo.byTargets(targets));
    return this.toRows(entries);
  }

  async recent(limit = 20): Promise<ActivityEntry[]> {
    return readInTenant(() => this.repo.recent(limit));
  }

  async toRows(entries: ActivityEntry[]): Promise<ActivityRow[]> {
    const names = await this.directory.userNames(entries.map((e) => e.actorId));
    return entries.map((e) => ({
      id: e.id,
      actor: e.actorId ? (names.get(e.actorId) ?? "—") : "—",
      action: e.action,
      target: e.targetLabel,
      at: e.at.toISOString(),
    }));
  }
}
