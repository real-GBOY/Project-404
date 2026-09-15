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
import { ErrorState } from "@/components/feedback/error-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { QuickCreateModal } from "@/components/tables/quick-create-modal";
import { useAuth } from "@/features/auth/auth-provider";
import { useTeamDirectory } from "@/api/team";
import { useCustomer, useActivities, useCreateActivity } from "@/api/crm";
import { useUnitDirectory } from "@/api/properties";
import { useContracts, useCreateReservation } from "@/api/sales";
import { usePayments } from "@/api/finance";
import { useDocuments } from "@/api/operations";
import { formatEgp, formatEgpExact } from "@/lib/money";
import { formatDate, timeAgo } from "@/lib/time";
import { titleCase } from "@/lib/text";
import { ApiError } from "@/config";

const TABS = ["Overview", "Units", "Payments", "Contracts", "Documents", "Activity"] as const;
type CustomerTab = (typeof TABS)[number];

interface OwnedUnitView {
  unitId: string;
  location: string;
  price: string;
  status: string;
}

const unitsColumns: DataColumn<OwnedUnitView>[] = [
  { key: "unitId", label: "Unit", width: 90, render: (r) => TextCell({ value: r.unitId, mono: true }) },
  { key: "location", label: "Location", flex: 1.4, render: (r) => TextCell({ value: r.location, weight: "normal" }) },
  { key: "price", label: "Price", width: 120, align: "end", render: (r) => TextCell({ value: r.price, mono: true }) },
  { key: "status", label: "Status", width: 88, render: (r) => BadgeCell({ status: r.status }) },
];

interface PaymentView2 {
  ref: string;
  label: string;
  date: string;
  amount: string;
  status: string;
}

const paymentsColumns: DataColumn<PaymentView2>[] = [
  { key: "ref", label: "Ref", width: 96, render: (r) => TextCell({ value: r.ref, mono: true, weight: "normal" }) },
  { key: "label", label: "Method", flex: 1.2, render: (r) => TextCell({ value: r.label, weight: "normal" }) },
  { key: "date", label: "Date", width: 100, render: (r) => TextCell({ value: r.date, mono: true, weight: "normal" }) },
  { key: "amount", label: "Amount", width: 120, align: "end", render: (r) => TextCell({ value: r.amount, mono: true }) },
  { key: "status", label: "Status", width: 88, render: (r) => BadgeCell({ status: r.status }) },
];

interface ContractView2 {
  id: string;
  unitId: string;
  value: string;
  signed: string;
  status: string;
}

const contractsColumns: DataColumn<ContractView2>[] = [
  { key: "id", label: "Contract", width: 96, render: (r) => TextCell({ value: r.id, mono: true, weight: "normal" }) },
  { key: "unitId", label: "Unit", width: 90, render: (r) => TextCell({ value: r.unitId, mono: true, weight: "normal" }) },
  { key: "value", label: "Value", width: 130, align: "end", render: (r) => TextCell({ value: r.value, mono: true }) },
  { key: "signed", label: "Signed", width: 100, render: (r) => TextCell({ value: r.signed, mono: true, weight: "normal" }) },
  { key: "status", label: "Status", width: 88, render: (r) => BadgeCell({ status: r.status }) },
];

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [tab, setTab] = useState<CustomerTab>("Overview");
  const [logActivityOpen, setLogActivityOpen] = useState(false);
  const [newReservationOpen, setNewReservationOpen] = useState(false);

  const customer = useCustomer(id);
  const team = useTeamDirectory();
  const units = useUnitDirectory();
  const payments = usePayments({ customerId: id });
  const contracts = useContracts();
  const documents = useDocuments({ relatedType: "customer", relatedId: id });
  const activities = useActivities({ relatedType: "customer", relatedId: id });
  const createActivity = useCreateActivity();
  const createReservation = useCreateReservation();
  const auth = useAuth();

  const loading = customer.isLoading || team.isLoading || units.isLoading;

  if (loading) {
    return (
      <PageContainer>
        <BackLink />
        <RowsSkeleton rows={6} cols={3} />
      </PageContainer>
    );
  }

  if (customer.error) {
    return (
      <PageContainer>
        <BackLink />
        <ErrorState title="Couldn't load this customer" message={customer.error instanceof ApiError ? customer.error.message : "The request failed."} />
      </PageContainer>
    );
  }

  if (!customer.data) {
    return (
      <PageContainer>
        <BackLink />
        <EmptyState icon="customer" title="Customer not found" description={`No customer with ID "${id ?? ""}" exists in this workspace.`} />
      </PageContainer>
    );
  }

  const c = customer.data;
  const agentName = team.byId.get(c.agentId) ?? c.agentId;
  const ownedUnits: OwnedUnitView[] = c.unitsOwned.map((unitId) => {
    const u = units.byId.get(unitId);
    return { unitId: u?.code ?? unitId, location: u?.location ?? "—", price: u ? formatEgpExact(u.basePriceEgp) : "—", status: u ? titleCase(u.status) : "—" };
  });

  const availableUnits = [...units.byId.entries()].filter(([, u]) => u.status === "available");

  return (
    <PageContainer>
      <BackLink />

      <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={c.name} size={44} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="m-0 text-[18px] font-semibold tracking-[-0.02em] text-foreground">{c.name}</h1>
              <StatusBadge status={titleCase(c.status)} />
              <span className="font-mono text-[10.5px] text-subtle">{c.id}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-secondary">
              <span>{c.email ?? "—"}</span>
              <span>{c.phone ?? "—"}</span>
              <span>{agentName}</span>
              <span>Customer since {formatDate(c.sinceDate)}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Button variant="secondary" size="sm" icon="history" onClick={() => setLogActivityOpen(true)}>
            Log activity
          </Button>
          <Button size="sm" icon="plus" onClick={() => setNewReservationOpen(true)}>
            New Reservation
          </Button>
        </div>
      </div>

      <KpiStrip className="mb-3.5">
        <KpiTile label="Portfolio value" value={formatEgp(c.portfolioEgp)} compact />
        <KpiTile label="Collected" value={formatEgp(c.collectedEgp)} compact />
        <KpiTile label="Units owned" value={String(c.unitsOwned.length)} compact />
        <KpiTile label="Agent" value={agentName} compact />
      </KpiStrip>

      <TabBar value={tab} onChange={setTab} tabs={TABS} className="mb-3.5" />

      {tab === "Overview" && (
        <Card>
          <div className="divide-y divide-border-row">
            <InfoRow label="Email" value={c.email ?? "—"} />
            <InfoRow label="Phone" value={c.phone ?? "—"} />
            <InfoRow label="Units owned" value={String(c.unitsOwned.length)} />
            <InfoRow label="Agent" value={agentName} />
            <InfoRow label="National ID" value={c.nationalId ?? "—"} />
            <InfoRow label="Address" value={c.address ?? "—"} />
          </div>
        </Card>
      )}

      {tab === "Units" && (
        <Card>
          <DataTable columns={unitsColumns} rows={ownedUnits} rowKey={(r) => r.unitId} emptyTitle="No owned units" />
        </Card>
      )}

      {tab === "Payments" && (
        <Card>
          <DataTable
            columns={paymentsColumns}
            rows={(payments.data ?? []).map((p) => ({ ref: p.reference, label: titleCase(p.method), date: formatDate(p.paidAt), amount: formatEgpExact(p.amountEgp), status: titleCase(p.status) }))}
            rowKey={(r) => r.ref}
            loading={payments.isLoading}
            emptyTitle="No payments"
          />
        </Card>
      )}

      {tab === "Contracts" && (
        <Card>
          <DataTable
            columns={contractsColumns}
            rows={(contracts.data ?? [])
              .filter((k) => k.customerId === id)
              .map((k) => ({ id: k.id, unitId: units.byId.get(k.unitId)?.code ?? k.unitId, value: formatEgp(k.valueEgp), signed: k.signedDate ? formatDate(k.signedDate) : "—", status: titleCase(k.status) }))}
            rowKey={(r) => r.id}
            loading={contracts.isLoading}
            emptyTitle="No contracts"
          />
        </Card>
      )}

      {tab === "Documents" && (
        <Card className="p-3">
          {documents.isLoading ? (
            <RowsSkeleton rows={3} cols={2} />
          ) : (documents.data ?? []).length === 0 ? (
            <EmptyState icon="doc" title="No documents available" description="Documents uploaded against this customer will appear here." />
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {(documents.data ?? []).map((doc) => (
                <div key={doc.id} className="rounded-card border border-border p-2.5">
                  <div className="flex h-16 items-center justify-center rounded-[2px] border border-dashed border-faint text-subtle">
                    <Icon name="doc" size={20} />
                  </div>
                  <div className="mt-2 truncate text-[11px] font-semibold text-body">{doc.name}</div>
                  <div className="mt-0.5 flex items-center justify-between">
                    <span className="text-[10px] text-subtle">{titleCase(doc.docType)}</span>
                    <StatusBadge status={titleCase(doc.status)} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "Activity" && (
        <Card className="p-3">
          {activities.isLoading ? (
            <RowsSkeleton rows={4} cols={2} />
          ) : (activities.data ?? []).length === 0 ? (
            <EmptyState icon="history" title="No activity recorded" description="Calls, viewings, notes and payments logged against this customer will appear here." />
          ) : (
            <div className="flex flex-col">
              {(activities.data ?? []).map((entry, i, arr) => (
                <div key={entry.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center">
                    <span className="mt-1 size-2 flex-none rounded-full bg-primary" />
                    {i < arr.length - 1 && <span className="w-px flex-1 bg-border-row" />}
                  </div>
                  <div className="min-w-0 flex-1 pb-3.5">
                    <div className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-muted">{titleCase(entry.type)}</div>
                    <div className="mt-0.5 text-[11.5px] text-body">{entry.subject}{entry.outcome ? ` — ${entry.outcome}` : ""}</div>
                    <div className="mt-0.5 text-[10px] text-subtle">{timeAgo(entry.occurredAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <QuickCreateModal
        open={logActivityOpen}
        onOpenChange={setLogActivityOpen}
        config={{
          title: "Log Activity",
          submitLabel: "Log Activity",
          fields: [
            {
              name: "type",
              label: "Type",
              type: "select",
              required: true,
              defaultValue: "call",
              options: ["call", "meeting", "viewing", "email", "note", "whatsapp"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
            },
            { name: "subject", label: "Subject", required: true, placeholder: "What happened?" },
            { name: "outcome", label: "Outcome", placeholder: "e.g. Confirmed payment, follow-up needed…" },
            { name: "agentId", label: "Agent", type: "select", required: true, defaultValue: auth.user?.id, options: team.members.map((m) => ({ value: m.id, label: m.name })) },
          ],
          onSubmit: async (values) => {
            await createActivity.mutateAsync({
              type: values.type as never,
              subject: values.subject,
              relatedType: "customer",
              relatedId: id,
              agentId: values.agentId,
              outcome: values.outcome || null,
            });
          },
        }}
      />

      <QuickCreateModal
        open={newReservationOpen}
        onOpenChange={setNewReservationOpen}
        config={{
          title: "New Reservation",
          submitLabel: "Reserve Unit",
          fields: [
            { name: "unitId", label: "Unit", type: "select", required: true, options: availableUnits.map(([uid, u]) => ({ value: uid, label: `${u.code} · ${u.location}` })) },
            { name: "depositEgp", label: "Deposit (EGP)", type: "number", required: true, placeholder: "150000" },
            { name: "agentId", label: "Agent", type: "select", required: true, defaultValue: auth.user?.id, options: team.members.map((m) => ({ value: m.id, label: m.name })) },
          ],
          onSubmit: async (values) => {
            await createReservation.mutateAsync({ unitId: values.unitId, customerId: id!, agentId: values.agentId, depositEgp: Number(values.depositEgp) });
          },
        }}
      />
    </PageContainer>
  );
}

function BackLink() {
  return (
    <Link to="/customers" className="mb-3 inline-flex w-fit items-center gap-1 text-[11px] font-medium text-secondary hover:text-foreground">
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
