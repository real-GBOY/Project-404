import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { FloorRow, UNIT_LEGEND, type UnitStatus } from "@/components/domain/unit-grid";
import { EmptyState } from "@/components/feedback/empty-state";
import { getProjectBuildings, type GeneratedUnit } from "./generate-units";

/** Same status→tailwind-class colors `UnitCell` already paints with (design tokens in tokens.css) —
 *  reused here only for the small legend swatches, never duplicated as raw hex. */
const LEGEND_SWATCH: Record<UnitStatus, string> = {
  Sold: "bg-unit-sold border-unit-sold-border",
  Available: "bg-unit-available-fill border-unit-available-border",
  Reserved: "bg-unit-reserved-fill border-unit-reserved-border",
  "On Hold": "bg-unit-hold-fill border-unit-hold-border",
  Unavailable: "bg-unit-unavailable-fill border-unit-unavailable-border",
};

/**
 * The building-tabs + color-legend + floor-by-floor unit grid block, shared between the standalone
 * Units page (`/units`) and the Project Detail → Inventory tab (PLAN §3 items 5 & 7 — same component,
 * scoped by `projectId`). Floors render highest-first (top-down), the usual real-building convention.
 */
export function BuildingInventory({
  projectId,
  onUnitClick,
}: {
  projectId: string;
  onUnitClick: (unit: GeneratedUnit) => void;
}) {
  const buildings = getProjectBuildings(projectId);
  const [buildingKey, setBuildingKey] = useState<string | undefined>(buildings[0]?.building.key);
  const active = buildings.find((b) => b.building.key === buildingKey) ?? buildings[0];

  if (buildings.length === 0 || !active) {
    return <EmptyState icon="building" title="No buildings for this project" description="No building layout is configured for this project yet." />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {buildings.map((b) => (
          <Chip key={b.building.key} active={b.building.key === active.building.key} activeVariant="pale" onClick={() => setBuildingKey(b.building.key)}>
            {b.building.name}
          </Chip>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        {UNIT_LEGEND.map((l) => (
          <span key={l.status} className="flex items-center gap-1.5 text-[10.5px] text-body">
            <i className={cn("inline-block size-2.5 rounded-[1px] border", LEGEND_SWATCH[l.status])} />
            {l.label}
          </span>
        ))}
      </div>

      <Card>
        {active.floors.map((f) => (
          <FloorRow
            key={f.floor}
            floor={`F${f.floor}`}
            units={f.units}
            onSelect={(u) => onUnitClick(f.units.find((gu) => gu.id === u.id)!)}
          />
        ))}
      </Card>
    </div>
  );
}
