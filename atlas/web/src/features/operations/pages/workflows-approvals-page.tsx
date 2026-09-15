import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, TextCell, BadgeCell, type DataColumn } from "@/components/tables/data-table";
import { WorkflowStepper, type WorkflowStep } from "@/components/domain/workflow-stepper";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useToast } from "@/lib/toast/toast-provider";
import { ApiError } from "@/lib/api/client";
import { useTeamDirectory } from "@/api/team";
import { useWorkflows, useAdvanceWorkflowStep, useApprovals, useDecideApproval, toApprovalView, type ApprovalView } from "@/api/operations";

/**
 * Single screen behind two nav entries — Operations → Workflows AND
 * Operations → Approvals. One step-tracker for the most recent workflow
 * instance + one pending-approvals queue, both backed by real data.
 */
export function WorkflowsApprovalsPage() {
  const toast = useToast();
  const workflows = useWorkflows();
  const advanceStep = useAdvanceWorkflowStep();
  const approvals = useApprovals();
  const team = useTeamDirectory();
  const decideApproval = useDecideApproval();

  if (workflows.isLoading || approvals.isLoading || team.isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Workflows & Approvals" />
        <RowsSkeleton rows={6} cols={4} />
      </PageContainer>
    );
  }

  const error = workflows.error ?? approvals.error ?? team.error;
  if (error) {
    return (
      <PageContainer>
        <PageHeader title="Workflows & Approvals" />
        <ErrorState title="Couldn't load workflows" message={error instanceof ApiError ? error.message : "The request failed."} />
      </PageContainer>
    );
  }

  const workflow = workflows.data?.[0];
  const steps: WorkflowStep[] = (workflow?.steps ?? []).map((s) => ({
    label: s.label,
    who: s.assigneeId ? team.byId.get(s.assigneeId) ?? s.assigneeId : "Unassigned",
    when: "—",
    state: s.state,
    note: s.state === "current" ? `Waiting on ${s.assigneeId ? team.byId.get(s.assigneeId) ?? s.assigneeId : "assignee"}` : undefined,
  }));
  const currentStep = workflow?.steps.find((s) => s.state === "current");

  async function handleApprove(row: ApprovalView) {
    try {
      await decideApproval.mutateAsync({ id: row.id, decision: "approved" });
      toast.push({ kind: "success", title: "Approved", body: `${row.kind} for ${row.subject} moved to the next step.` });
    } catch (err) {
      toast.push({ kind: "danger", title: "Couldn't approve", body: err instanceof ApiError ? err.message : "Something went wrong." });
    }
  }

  async function handleReject(row: ApprovalView) {
    try {
      await decideApproval.mutateAsync({ id: row.id, decision: "rejected" });
      toast.push({ kind: "warning", title: "Rejected", body: `${row.kind} for ${row.subject} sent back to ${row.who}.` });
    } catch (err) {
      toast.push({ kind: "danger", title: "Couldn't reject", body: err instanceof ApiError ? err.message : "Something went wrong." });
    }
  }

  const rows = (approvals.data ?? []).map((r) => toApprovalView(r, (id) => team.byId.get(id) ?? id));
  const pending = rows.filter((r) => r.status === "Awaiting Approval" || r.status === "Escalated");
  const escalated = rows.filter((r) => r.status === "Escalated").length;

  const columns: DataColumn<ApprovalView>[] = [
    { key: "kind", label: "Type", flex: 1.3, render: (r) => <TextCell value={r.kind} /> },
    { key: "subject", label: "Subject", flex: 1.8, render: (r) => <TextCell value={r.subject} weight="normal" /> },
    { key: "amount", label: "Amount", width: 148, render: (r) => <TextCell value={r.amount} mono /> },
    { key: "who", label: "Submitted by", flex: 1, render: (r) => <TextCell value={r.who} weight="normal" /> },
    { key: "step", label: "Step", width: 90, render: (r) => <TextCell value={r.step} mono weight="normal" /> },
    { key: "age", label: "Age", width: 60, render: (r) => <TextCell value={r.age} mono weight="normal" /> },
    { key: "status", label: "Status", width: 118, render: (r) => <BadgeCell status={r.status} /> },
    {
      key: "actions",
      label: "",
      width: 156,
      align: "end",
      render: (r) => (
        <div className="flex items-center justify-end gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => handleReject(r)}>
            Reject
          </Button>
          <Button size="sm" onClick={() => handleApprove(r)}>
            Approve
          </Button>
        </div>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHeader title="Workflows & Approvals" description={`${workflows.data?.length ?? 0} workflow definitions · ${pending.length} approvals pending${escalated ? ` · ${escalated} escalated` : ""}`} />

      <div className="mb-3.5">
        {workflow ? (
          <div className="rounded-card border border-border bg-surface p-3.5">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[12px] font-semibold">{workflow.name}</div>
              {currentStep && (
                <Button size="sm" onClick={() => advanceStep.mutate({ workflowId: workflow.id, seqNo: currentStep.seqNo })}>
                  Advance Step
                </Button>
              )}
            </div>
            <WorkflowStepper title="" steps={steps} />
          </div>
        ) : (
          <Card>
            <EmptyState icon="workflow" title="No workflows yet" description="Workflow definitions with ordered approval steps will appear here once created." />
          </Card>
        )}
      </div>

      <Card>
        <CardHeader title="Pending Approvals" subtitle={`${pending.length} awaiting action${escalated ? ` · ${escalated} escalated past SLA` : ""}`} />
        <DataTable
          columns={columns}
          rows={pending}
          rowKey={(r) => r.id}
          minWidth={880}
          emptyTitle="All caught up"
          emptyDescription="New contract, discount, price-list, reservation-extension, payout and refund requests will appear here the moment they're submitted for approval."
        />
      </Card>
    </PageContainer>
  );
}
