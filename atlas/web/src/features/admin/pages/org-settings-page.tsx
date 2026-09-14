import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface SettingRow {
  label: string;
  value: string;
}

interface SettingGroup {
  title: string;
  rows: SettingRow[];
}

const GROUPS: SettingGroup[] = [
  {
    title: "Organisation",
    rows: [
      { label: "Legal name", value: "Atlas Developments Holding" },
      { label: "Primary market", value: "Egypt — Cairo & Giza" },
      { label: "Base currency", value: "EGP" },
      { label: "Fiscal year start", value: "January" },
      { label: "Time zone", value: "Africa/Cairo (UTC+2)" },
    ],
  },
  {
    title: "Sales policy",
    rows: [
      { label: "Reservation hold period", value: "72 hours" },
      { label: "Max discount without approval", value: "3%" },
      { label: "Lead auto-assignment", value: "Round robin by territory" },
      { label: "Pipeline stage SLA (Viewing → Negotiation)", value: "5 business days" },
    ],
  },
  {
    title: "Finance",
    rows: [
      { label: "Default payment plan", value: "10% DP · 5yr equal installments" },
      { label: "Late payment grace period", value: "7 days" },
      { label: "Overdue escalation", value: "After 2 missed installments" },
      { label: "Commission payout cadence", value: "Monthly, on collection" },
    ],
  },
  {
    title: "AI & automation",
    rows: [
      { label: "AI Copilot access", value: "All Commercial & Finance roles" },
      { label: "Dashboard AI insights", value: "Enabled" },
      { label: "Auto follow-up task creation", value: "Enabled — stale leads >7 days" },
      { label: "Data scope for Copilot", value: "Org-wide, permission-scoped per user" },
    ],
  },
];

export function OrgSettingsPage() {
  return (
    <PageContainer>
      <PageHeader title="Organization Settings" description="Policies that shape how Sales, Finance, and AI behave across Atlas." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {GROUPS.map((g) => (
          <Card key={g.title}>
            <CardHeader title={g.title} action={<Button variant="secondary" size="sm" icon="edit">Edit</Button>} />
            <div className="flex flex-col">
              {g.rows.map((r) => (
                <div key={r.label} className="flex items-center gap-3 border-b border-border-row px-3 py-2.5 last:border-0">
                  <span className="flex-1 text-[11px] text-secondary">{r.label}</span>
                  <span className="text-end text-[11.5px] font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
