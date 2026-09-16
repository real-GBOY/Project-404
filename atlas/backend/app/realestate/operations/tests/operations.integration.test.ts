import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TestingModule } from "@nestjs/testing";
import {
  asUser,
  createRealestateTestApp,
  get,
  hasTestDb,
  seedOrg,
  type SeededOrg,
} from "@atlas/realestate/tests/helpers.js";
import { TasksService } from "@atlas/realestate/operations/application/tasks-service.js";
import { ApprovalsService } from "@atlas/realestate/operations/application/approvals-service.js";
import { WorkflowsService } from "@atlas/realestate/operations/application/workflows-service.js";

const suite = hasTestDb ? describe : describe.skip;

suite("realestate/operations", () => {
  let app: TestingModule;
  let orgA: SeededOrg;
  let orgB: SeededOrg;
  const tasks = () => get<TasksService>(app, TasksService);
  const approvals = () => get<ApprovalsService>(app, ApprovalsService);
  const workflows = () => get<WorkflowsService>(app, WorkflowsService);

  beforeAll(async () => {
    app = await createRealestateTestApp();
    orgA = await seedOrg(app, "Developer A");
    orgB = await seedOrg(app, "Developer B");
  }, 60_000);

  afterAll(async () => {
    await app?.close();
  });

  it("creates a task and moves it through statuses", async () => {
    const created = await asUser(orgA.adminId, orgA.orgId, () =>
      tasks().create({ title: "Follow up with lead", assigneeId: orgA.adminId, dueAt: "2026-12-01T00:00:00.000Z" }),
    );
    expect(created.status).toBe("open");
    const done = await asUser(orgA.adminId, orgA.orgId, () => tasks().updateStatus(created.id, "done"));
    expect(done.status).toBe("done");
  });

  it("approving an approval flips its status", async () => {
    const created = await asUser(orgA.adminId, orgA.orgId, () =>
      approvals().create({ kind: "discount", subject: "5% discount on unit A-0904", requestedBy: orgA.adminId }),
    );
    expect(created.status).toBe("awaiting-approval");
    const decided = await asUser(orgA.adminId, orgA.orgId, () => approvals().decide(created.id, "approved", orgA.adminId));
    expect(decided.status).toBe("approved");
  });

  it("a multi-step workflow starts on step 1 and advances one step at a time", async () => {
    const created = await asUser(orgA.adminId, orgA.orgId, () =>
      workflows().create({ name: "Contract approval", steps: [{ label: "Legal review" }, { label: "Finance sign-off" }] }),
    );
    expect(created.steps[0].state).toBe("current");
    expect(created.steps[1].state).toBe("pending");
    const advanced = await asUser(orgA.adminId, orgA.orgId, () => workflows().advance(created.id, 1));
    expect(advanced.steps[0].state).toBe("done");
    expect(advanced.steps[1].state).toBe("current");
  });

  it("tenant isolation: developer B cannot see developer A's tasks or approvals", async () => {
    const task = await asUser(orgA.adminId, orgA.orgId, () =>
      tasks().create({ title: "A-only task", assigneeId: orgA.adminId, dueAt: "2026-12-01T00:00:00.000Z" }),
    );
    const approval = await asUser(orgA.adminId, orgA.orgId, () =>
      approvals().create({ kind: "other", subject: "A-only approval", requestedBy: orgA.adminId }),
    );
    const bTasks = await asUser(orgB.adminId, orgB.orgId, () => tasks().list());
    expect(bTasks.some((t) => t.id === task.id)).toBe(false);
    const bApprovals = await asUser(orgB.adminId, orgB.orgId, () => approvals().list());
    expect(bApprovals.some((a) => a.id === approval.id)).toBe(false);
  });
});
