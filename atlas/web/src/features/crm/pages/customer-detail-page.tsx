import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageContainer } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { KpiStrip, KpiTile } from "@/components/ui/kpi-tile";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/pill";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TabBar } from "@/components/ui/tabs";
import { DataTable, TextCell, BadgeCell } from "@/components/tables/data-table";
import type { DataColumn } from "@/components/tables/data-table";
import { EmptyState } from "@/components/feedback/empty-state";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useToast } from "@/lib/toast/toast-provider";
import {
  CUSTOMERS,
  CUSTOMER_DETAIL_C1,
  type CustomerOwnedUnitFixture,
  type CustomerPaymentFixture,
  type CustomerContractFixture,
} from "@/mocks/fixtures/customers";

const TABS = ["Overview", "Units", "Payments", "Contracts", "Documents", "Activity"] as const;
type CustomerTab = (typeof TABS)[number];

const unitsColumns: DataColumn<CustomerOwnedUnitFixture>[] = [
  { key: "unitId", label: "Unit", width: 90, render: (r) => TextCell({ value: r.unitId, mono: true }) },
  { key: "location", label: "Location", flex: 1.4, render: (r) => TextCell({ value: r.location, weight: "normal" }) },
  { key: "spec", label: "Spec", flex: 0.9, render: (r) => TextCell({ value: r.spec, weight: "normal" }) },
  { key: "price", label: "Price", width: 120, align: "end", render: (r) => TextCell({ value: r.price, mono: true }) },
  { key: "status", label: "Status", width: 88, render: (r) => BadgeCell({ status: r.status }) },
];

const paymentsColumns: DataColumn<CustomerPaymentFixture>[] = [
  { key: "ref", label: "Ref", width: 96, render: (r) => TextCell({ value: r.ref, mono: true, weight: "normal" }) },
  { key: "label", label: "Installment", flex: 1.2, render: (r) => TextCell({ value: r.label, weight: "normal" }) },
  { key: "date", label: "Date", width: 100, render: (r) => TextCell({ value: r.date, mono: true, weight: "normal" }) },
  { key: "amount", label: "Amount", width: 120, align: "end", render: (r) => TextCell({ value: r.amount, mono: true }) },
  { key: "status", label: "Status", width: 88, render: (r) => BadgeCell({ status: r.status }) },
];

const contractsColumns: DataColumn<CustomerContractFixture>[] = [
  { key: "id", label: "Contract", width: 96, render: (r) => TextCell({ value: r.id, mono: true, weight: "normal" }) },
  { key: "unitId", label: "Unit", width: 90, render: (r) => TextCell({ value: r.unitId, mono: true, weight: "normal" }) },
  { key: "value", label: "Value", width: 130, align: "end", render: (r) => TextCell({ value: r.value, mono: true }) },
  { key: "signed", label: "Signed", width: 100, render: (r) => TextCell({ value: r.signed, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 88, render: (r) => BadgeCell({ status: r.status }) },
];

const NO_DETAIL_WHY =
  "Full unit, payment, contract, document and activity records were only authored for the demo customer (Karim Abdelrahman / c1) in this prototype — this customer's detail records aren't available yet.";

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const confirm = useConfirm();
  const toast = useToast();
  const [tab, setTab] = useState<CustomerTab>("Overview");

  const customer = CUSTOMERS.find((c) => c.id === id);
  const detail = id === "c1" ? CUSTOMER_DETAIL_C1 : null;

  if (!customer) {
    return (
      <PageContainer>
        <BackLink />
        <EmptyState
          icon="customer"
          title="Customer not found"
          description={`No customer with ID "${id ?? ""}" exists in this workspace.`}
        />
      </PageContainer>
    );
  }

  async function handleLogActivity() {
    const ok = await confirm({
      title: "Log activity",
      body: "This is a mock action — no backend is connected yet.",
      cta: "Log activity",
    });
    if (ok) toast.push({ kind: "success", title: "Activity logged", body: `Recorded against ${customer!.name}.` });
  }

  async function handleNewReservation() {
    const ok = await confirm({
      title: "New Reservation",
      body: "This is a mock action — no backend is connected yet.",
      cta: "Create reservation",
    });
    if (ok) toast.push({ kind: "success", title: "Reservation created", body: `Added for ${customer!.name}.` });
  }

  const kpis = detail
    ? detail.kpis
    : [
        { label: "Portfolio value", value: customer.portfolioValue },
        { label: "Collected", value: customer.collected },
        { label: "Units owned", value: String(customer.unitsOwned) },
        { label: "Primary project", value: customer.primaryProject },
      ];

  return (
    <PageContainer>
      <BackLink />

      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={customer.name} size={44} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="m-0 text-[18px] font-semibold tracking-[-0.02em] text-foreground">{customer.name}</h1>
              <StatusBadge status={customer.status} />
              <span className="font-mono text-[10.5px] text-subtle">{customer.id}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-secondary">
              <span>{customer.email}</span>
              <span>{customer.phone}</span>
              <span>{customer.agent}</span>
              {detail && <span>{detail.since}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button variant="secondary" size="sm" icon="history" onClick={handleLogActivity}>
            Log activity
          </Button>
          <Button size="sm" icon="plus" onClick={handleNewReservation}>
            New Reservation
          </Button>
        </div>
      </div>

      <KpiStrip className="mb-3.5">
        {kpis.map((k) => (
          <KpiTile key={k.label} {...k} compact />
        ))}
      </KpiStrip>

      <TabBar value={tab} onChange={setTab} tabs={TABS} className="mb-3.5" />

      {tab === "Overview" && (
        <Card>
          <div className="divide-y divide-border-row">
            <InfoRow label="Email" value={customer.email} />
            <InfoRow label="Phone" value={customer.phone} />
            <InfoRow label="Primary project" value={customer.primaryProject} />
            <InfoRow label="Units owned" value={String(customer.unitsOwned)} />
            <InfoRow label="Agent" value={customer.agent} />
            {detail && <InfoRow label="National ID" value={detail.nationalId} />}
            {detail && <InfoRow label="Address" value={detail.address} />}
          </div>
        </Card>
      )}

      {tab === "Units" && (
        <Card>
          {detail ? (
            <DataTable
              columns={unitsColumns}
              rows={detail.ownedUnits}
              rowKey={(r) => r.unitId}
              emptyTitle="No owned units"
            />
          ) : (
            <EmptyState icon="unit" title="No unit records available" description={NO_DETAIL_WHY} />
          )}
        </Card>
      )}

      {tab === "Payments" && (
        <Card>
          {detail ? (
            <DataTable
              columns={paymentsColumns}
              rows={detail.payments}
              rowKey={(r) => r.ref}
              emptyTitle="No payments"
            />
          ) : (
            <EmptyState icon="payment" title="No payment records available" description={NO_DETAIL_WHY} />
          )}
        </Card>
      )}

      {tab === "Contracts" && (
        <Card>
          {detail ? (
            <DataTable
              columns={contractsColumns}
              rows={detail.contracts}
              rowKey={(r) => r.id}
              emptyTitle="No contracts"
            />
          ) : (
            <EmptyState icon="doc" title="No contract records available" description={NO_DETAIL_WHY} />
          )}
        </Card>
      )}

      {tab === "Documents" && (
        <Card className="p-3">
          {detail ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {detail.documents.map((doc) => (
                <div key={doc.name} className="rounded-card border border-border p-2.5">
                  <div className="flex h-16 items-center justify-center rounded-[2px] border border-dashed border-faint text-subtle">
                    <Icon name="doc" size={20} />
                  </div>
                  <div className="mt-2 truncate text-[11px] font-semibold text-body">{doc.name}</div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="text-[10px] text-subtle">{doc.size}</span>
                    <StatusBadge status={doc.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="doc" title="No documents available" description={NO_DETAIL_WHY} />
          )}
        </Card>
      )}

      {tab === "Activity" && (
        <Card className="p-3">
          {detail ? (
            <div className="flex flex-col">
              {detail.timeline.map((entry, i) => (
                <div key={`${entry.kind}-${entry.when}`} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 size-2 flex-none rounded-full" style={{ background: entry.color }} />
                    {i < detail.timeline.length - 1 && <span className="w-px flex-1 bg-border-row" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-3.5">
                    <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">
                      {entry.kind}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-body">{entry.text}</div>
                    <div className="mt-0.5 text-[10px] text-subtle">{entry.when}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon="history" title="No activity recorded" description={NO_DETAIL_WHY} />
          )}
        </Card>
      )}
    </PageContainer>
  );
}

function BackLink() {
  return (
    <Link
      to="/customers"
      className="mb-3 inline-flex w-fit items-center gap-1 text-[11px] font-medium text-secondary hover:text-foreground"
    >
      <Icon name="chevron-left" size={12} />
      Back to Customers
    </Link>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5">
      <span className="text-[10.5px] text-subtle">{label}</span>
      <span className="text-[11.5px] font-medium text-body">{value}</span>
    </div>
  );
}
