import { Injectable } from "@nestjs/common";
import { requireOrganizationId } from "@core/kernel/tenant.js";
import { realestateDb } from "@atlas/realestate/db/executor.js";
import { realestateId } from "@atlas/realestate/shared/ids.js";

export type StepState = "done" | "current" | "pending";

export interface WorkflowStepRow {
  id: string;
  workflowId: string;
  seqNo: number;
  label: string;
  assigneeId: string | null;
  state: StepState;
}

export interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
}

export interface CreateWorkflowInput {
  name: string;
  description?: string | null;
  steps: Array<{ label: string; assigneeId?: string | null }>;
}

@Injectable()
export class WorkflowsRepository {
  private org(): string {
    return requireOrganizationId();
  }

  async list(): Promise<WorkflowRow[]> {
    const rows = await realestateDb()
      .selectFrom("realestate_workflows")
      .selectAll()
      .where("organization_id", "=", this.org())
      .orderBy("name", "asc")
      .execute();
    return rows.map((r) => this.toRow(r));
  }

  async findById(id: string): Promise<WorkflowRow | null> {
    const row = await realestateDb()
      .selectFrom("realestate_workflows")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("id", "=", id)
      .executeTakeFirst();
    return row ? this.toRow(row) : null;
  }

  async steps(workflowId: string): Promise<WorkflowStepRow[]> {
    const rows = await realestateDb()
      .selectFrom("realestate_workflow_steps")
      .selectAll()
      .where("organization_id", "=", this.org())
      .where("workflow_id", "=", workflowId)
      .orderBy("seq_no", "asc")
      .execute();
    return rows.map((r) => this.toStepRow(r));
  }

  async create(input: CreateWorkflowInput): Promise<WorkflowRow> {
    const id = realestateId("wfl");
    const org = this.org();
    await realestateDb()
      .insertInto("realestate_workflows")
      .values({ id, organization_id: org, name: input.name, description: input.description ?? null })
      .execute();
    await realestateDb()
      .insertInto("realestate_workflow_steps")
      .values(
        input.steps.map((s, i) => ({
          id: realestateId("wfs"),
          organization_id: org,
          workflow_id: id,
          seq_no: i + 1,
          label: s.label,
          assignee_id: s.assigneeId ?? null,
          state: i === 0 ? "current" : "pending",
        })),
      )
      .execute();
    return (await this.findById(id))!;
  }

  async advanceStep(workflowId: string, seqNo: number): Promise<void> {
    const org = this.org();
    await realestateDb()
      .updateTable("realestate_workflow_steps")
      .set({ state: "done" })
      .where("organization_id", "=", org)
      .where("workflow_id", "=", workflowId)
      .where("seq_no", "=", seqNo)
      .execute();
    await realestateDb()
      .updateTable("realestate_workflow_steps")
      .set({ state: "current" })
      .where("organization_id", "=", org)
      .where("workflow_id", "=", workflowId)
      .where("seq_no", "=", seqNo + 1)
      .execute();
  }

  private toRow(r: { id: string; name: string; description: string | null; created_at: Date | string }): WorkflowRow {
    return { id: r.id, name: r.name, description: r.description, createdAt: new Date(r.created_at) };
  }

  private toStepRow(r: {
    id: string;
    workflow_id: string;
    seq_no: number;
    label: string;
    assignee_id: string | null;
    state: StepState;
  }): WorkflowStepRow {
    return { id: r.id, workflowId: r.workflow_id, seqNo: r.seq_no, label: r.label, assigneeId: r.assignee_id, state: r.state };
  }
}
