import { useNavigate } from "react-router-dom";
import { Drawer, DrawerSection } from "@/components/ui/drawer";
import { StatusBadge } from "@/components/ui/pill";
import { ProgressBar } from "@/components/ui/progress-bar";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import type { UnitStatus } from "./unit-grid";

export interface UnitDrawerInstallment {
  label: string;
  due: string;
  amount: string;
  status: string;
}

export interface UnitDrawerData {
  code: string;
  projectId: string;
  project: string;
  building: string;
  type: string;
  area: string;
  status: UnitStatus;
  price: string;
  paid?: string;
  remaining?: string;
  paidPct?: number;
  customer?: string;
  agent?: string;
  holdReason?: string;
  installments?: UnitDrawerInstallment[];
}

export function UnitDrawer({
  unit,
  open,
  onOpenChange,
  onReserve,
}: {
  unit: UnitDrawerData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReserve?: () => void;
}) {
  const navigate = useNavigate();
  if (!unit) return null;
  const canReserve = unit.status === "Available";
  const hasOwner = unit.status === "Sold" || unit.status === "Reserved";
  const showHoldNote = !hasOwner && !canReserve;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={`Unit ${unit.code}`}
      width={520}
      footer={
        canReserve ? (
          <Button className="ms-auto" onClick={onReserve}>
            Reserve unit
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="ms-auto"
            onClick={() => {
              onOpenChange(false);
              navigate(`/projects/${unit.projectId}`);
            }}
          >
            Open in project
          </Button>
        )
      }
    >
      <DrawerSection>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-[16px] font-semibold">{unit.code}</div>
            <div className="mt-0.5 text-[11px] text-secondary">
              {unit.project} · {unit.building} · {unit.type} · {unit.area}
            </div>
          </div>
          <StatusBadge status={unit.status} />
        </div>
        <div className="mt-3 text-[17px] font-semibold">{unit.price}</div>
      </DrawerSection>

      {hasOwner && (
        <DrawerSection title="Payment progress">
          <div className="mb-1.5 flex items-center justify-between text-[11px]">
            <span className="text-secondary">Paid {unit.paid}</span>
            <span className="text-subtle">Remaining {unit.remaining}</span>
          </div>
          <ProgressBar value={unit.paidPct ?? 0} height={8} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <div>
              <div className="text-subtle">Customer</div>
              <div className="font-medium">{unit.customer}</div>
            </div>
            <div>
              <div className="text-subtle">Agent</div>
              <div className="font-medium">{unit.agent}</div>
            </div>
          </div>
        </DrawerSection>
      )}

      {showHoldNote && (
        <DrawerSection title="Status note">
          <p className="text-[11.5px] text-secondary">
            {unit.holdReason ?? "This unit isn't currently listed for sale."}
          </p>
          <div className="mt-2 rounded-card border border-dashed border-faint px-3 py-4 text-center text-[11px] text-subtle">
            No payment plan yet
          </div>
        </DrawerSection>
      )}

      {hasOwner && unit.installments && unit.installments.length > 0 && (
        <DrawerSection title="Installment schedule">
          <div className="flex flex-col">
            {unit.installments.map((row, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-border-row py-1.5 last:border-0">
                <span className="flex-1 text-[11px]">{row.label}</span>
                <span className="font-mono text-[10.5px] text-subtle">{row.due}</span>
                <span className="w-20 flex-none text-end font-mono text-[11px] font-semibold">{row.amount}</span>
                <StatusBadge status={row.status} />
              </div>
            ))}
          </div>
        </DrawerSection>
      )}

      <DrawerSection title="Documents">
        <div className="flex items-center gap-2 text-[11px] text-secondary">
          <Icon name="doc" size={14} className="text-subtle" />
          No documents attached yet.
        </div>
      </DrawerSection>
    </Drawer>
  );
}
