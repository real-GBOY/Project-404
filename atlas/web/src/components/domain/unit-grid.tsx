import { cn } from "@/lib/cn";

export type UnitStatus = "Sold" | "Available" | "Reserved" | "On Hold" | "Unavailable";

export interface UnitCellData {
  id: string;
  code: string;
  type: string;
  status: UnitStatus;
}

const STATUS_CLASS: Record<UnitStatus, string> = {
  Sold: "bg-unit-sold border-unit-sold-border text-white",
  Available: "bg-unit-available-fill border-unit-available-border text-unit-available-fg",
  Reserved: "bg-unit-reserved-fill border-unit-reserved-border text-unit-reserved-fg",
  "On Hold": "bg-unit-hold-fill border-unit-hold-border text-unit-hold-fg",
  Unavailable: "bg-unit-unavailable-fill border-unit-unavailable-border text-unit-unavailable-fg",
};

export function UnitCell({ unit, onClick }: { unit: UnitCellData; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-[38px] w-[62px] flex-none flex-col items-center justify-center rounded-sm border text-center transition-[outline] outline outline-2 outline-offset-1 outline-transparent hover:outline-primary",
        STATUS_CLASS[unit.status],
      )}
      title={`${unit.code} · ${unit.type} · ${unit.status}`}
    >
      <span className="font-mono text-[10.5px] font-semibold leading-none">{unit.code}</span>
      <span className="mt-0.5 text-[8.5px] leading-none opacity-80">{unit.type}</span>
    </button>
  );
}

export function FloorRow({
  floor,
  units,
  onSelect,
}: {
  floor: string;
  units: UnitCellData[];
  onSelect?: (u: UnitCellData) => void;
}) {
  const available = units.filter((u) => u.status === "Available").length;
  return (
    <div className="flex items-center gap-2.5 border-b border-border-row px-3 py-1.5 last:border-0">
      <div className="w-[52px] flex-none font-mono text-[10px] text-subtle">{floor}</div>
      <div className="flex flex-1 flex-wrap gap-1.5">
        {units.map((u) => (
          <UnitCell key={u.id} unit={u} onClick={() => onSelect?.(u)} />
        ))}
      </div>
      <div className="w-16 flex-none text-end text-[10px] text-subtle">{available} avail</div>
    </div>
  );
}

export const UNIT_LEGEND: { status: UnitStatus; label: string }[] = [
  { status: "Available", label: "Available" },
  { status: "Reserved", label: "Reserved" },
  { status: "Sold", label: "Sold" },
  { status: "On Hold", label: "On Hold" },
  { status: "Unavailable", label: "Unavailable" },
];
