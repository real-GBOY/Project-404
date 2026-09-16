import { useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { QuickCreateModal, type QuickCreateConfig } from "@/components/tables/quick-create-modal";
import { useOrgSettings, useUpdateOrgSettings } from "@/api/admin";
import { ApiError } from "@/config";

type GroupKey = "sales" | "finance" | null;

/**
 * The real, backend-persisted policy knobs (`realestate_org_settings` —
 * see `atlas/backend/app/realestate/admin/admin.schema.ts`). Earlier this
 * page rendered a hardcoded mock of settings that don't exist anywhere in
 * the database (legal name, time zone, Copilot access…) — replaced with the
 * four fields the API actually reads and writes.
 */
export function OrgSettingsPage() {
  const settings = useOrgSettings();
  const update = useUpdateOrgSettings();
  const [editing, setEditing] = useState<GroupKey>(null);

  if (settings.isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Organization Settings" />
        <Card>
          <RowsSkeleton rows={4} cols={2} />
        </Card>
      </PageContainer>
    );
  }

  if (settings.error) {
    return (
      <PageContainer>
        <PageHeader title="Organization Settings" />
        <ErrorState title="Couldn't load settings" message={settings.error instanceof ApiError ? settings.error.message : "The request failed."} />
      </PageContainer>
    );
  }

  const s = settings.data!;

  const configs: Record<Exclude<GroupKey, null>, QuickCreateConfig> = {
    sales: {
      title: "Edit sales policy",
      submitLabel: "Save",
      fields: [
        { name: "reservationHoldDays", label: "Reservation hold period (days)", type: "number", required: true, defaultValue: String(s.reservationHoldDays) },
        { name: "defaultDiscountPct", label: "Max discount without approval (%)", type: "number", required: true, defaultValue: s.defaultDiscountPct },
      ],
      onSubmit: async (values) => {
        await update.mutateAsync({
          reservationHoldDays: Number(values.reservationHoldDays),
          defaultDiscountPct: Number(values.defaultDiscountPct),
        });
      },
    },
    finance: {
      title: "Edit finance & automation policy",
      submitLabel: "Save",
      fields: [
        { name: "escalationDays", label: "Overdue escalation (days)", type: "number", required: true, defaultValue: String(s.escalationDays) },
        { name: "aiInsightRefreshMinutes", label: "AI insight refresh interval (minutes)", type: "number", required: true, defaultValue: String(s.aiInsightRefreshMinutes) },
      ],
      onSubmit: async (values) => {
        await update.mutateAsync({
          escalationDays: Number(values.escalationDays),
          aiInsightRefreshMinutes: Number(values.aiInsightRefreshMinutes),
        });
      },
    },
  };

  return (
    <PageContainer>
      <PageHeader title="Organization Settings" description="Policies that shape how Sales, Finance, and AI behave across Atlas." />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card>
          <CardHeader
            title="Sales policy"
            action={
              <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditing("sales")}>
                Edit
              </Button>
            }
          />
          <div className="flex flex-col">
            <SettingRow label="Reservation hold period" value={`${s.reservationHoldDays} day${s.reservationHoldDays === 1 ? "" : "s"}`} />
            <SettingRow label="Max discount without approval" value={`${s.defaultDiscountPct}%`} />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Finance & automation"
            action={
              <Button variant="secondary" size="sm" icon="edit" onClick={() => setEditing("finance")}>
                Edit
              </Button>
            }
          />
          <div className="flex flex-col">
            <SettingRow label="Overdue escalation" value={`After ${s.escalationDays} day${s.escalationDays === 1 ? "" : "s"} past due`} />
            <SettingRow label="AI insight refresh interval" value={`Every ${s.aiInsightRefreshMinutes} min`} />
          </div>
        </Card>
      </div>

      <QuickCreateModal open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} config={editing ? configs[editing] : undefined} />
    </PageContainer>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 border-b border-border-row px-3 py-2.5 last:border-0">
      <span className="flex-1 text-[11px] text-secondary">{label}</span>
      <span className="text-end text-[11.5px] font-medium">{value}</span>
    </div>
  );
}
