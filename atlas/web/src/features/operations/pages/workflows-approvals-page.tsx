import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, TextCell, BadgeCell, type DataColumn } from "@/components/tables/data-table";
import { WorkflowStepper, type WorkflowStep } from "@/components/domain/workflow-stepper";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useToast } from "@/lib/toast/toast-provider";
import { WORKFLOW_EXAMPLE_STEPS } from "@/mocks/fixtures/workflows";
import { APPROVALS, type ApprovalFixture } from "@/mocks/fixtures/approvals";

const WORKFLOW_TITLE = "Reservation → Contract · C-0191 · Hala Mostafa";

const WORKFLOW_STEPS: WorkflowStep[] = WORKFLOW_EXAMPLE_STEPS.map((s) => ({
  label: s.label,
  who: s.who,
  when: s.when,
  state: s.state === "todo" ? "pending" : s.state,
  note: s.state === "current" ? `Waiting on ${s.who}` : undefined,
}));

function rowKey(r: ApprovalFixture): string {
  return `${r.kind}|${r.subject}`;
}

/**
 * Single screen behind two nav entries — Operations → Workflows AND
 * Operations → Approvals (PLAN §3 item 11, `isWorkflows`). The design
 * doesn't differentiate by route: one step-tracker for the in-flight
 * workflow instance + one pending-approvals queue, always both together.
 */
export function WorkflowsApprovalsPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [rows, setRows] = useState<ApprovalFixture[]>(APPROVALS);

  async function handleApprove(row: ApprovalFixture) {
    const ok = await confirm({
      title: "Approve this request?",
      body: `${row.kind} — ${row.subject} (${row.amount}). This will record an approval in the audit log and advance the workflow to its next step.`,
      cta: "Approve",
    });
    if (!ok) return;
    setRows((prev) => prev.filter((r) => rowKey(r) !== rowKey(row)));
    toast.push({ kind: "success", title: "Approved", body: `${row.kind} for ${row.subject} moved to the next step.` });
  }

  async function handleReject(row: ApprovalFixture) {
    const ok = await confirm({
      title: "Reject this request?",
      body: `${row.kind} — ${row.subject} will be sent back to ${row.who} with a rejection note recorded in the audit log.`,
      cta: "Reject",
      destructive: true,
    });
    if (!ok) return;
    setRows((prev) => prev.filter((r) => rowKey(r) !== rowKey(row)));
    toast.push({ kind: "warning", title: "Rejected", body: `${row.kind} for ${row.subject} sent back to ${row.who}.` });
  }

  const columns: DataColumn<ApprovalFixture>[] = [
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

  const escalated = rows.filter((r) => r.status === "Escalated").length;

  return (
    <PageContainer>
      <PageHeader
        title="Workflows & Approvals"
        description="4 active workflow definitions · 7 approvals pending · 2 escalated past SLA"
      />

      <div className="mb-3.5">
        <WorkflowStepper title={WORKFLOW_TITLE} steps={WORKFLOW_STEPS} />
      </div>

      <Card>
        <CardHeader
          title="Pending Approvals"
          subtitle={`${rows.length} awaiting action${escalated ? ` · ${escalated} escalated past SLA` : ""}`}
        />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={rowKey}
          minWidth={880}
          emptyTitle="All caught up"
          emptyDescription="New contract, discount, price-list, reservation-extension, payout and refund requests will appear here the moment they're submitted for approval."
        />
      </Card>
    </PageContainer>
  );
}
