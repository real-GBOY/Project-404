import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/cn";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { FloorRow, UNIT_LEGEND, type UnitCellData, type UnitStatus } from "@/components/domain/unit-grid";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { useBuildings, useProjectDirectory, useUnits, type UnitRow } from "@/api/properties";
import { ApiError } from "@/lib/api/client";

/** Same status→tailwind-class colors `UnitCell` already paints with (design tokens in tokens.css) —
 *  reused here only for the small legend swatches, never duplicated as raw hex. */
const LEGEND_SWATCH: Record<UnitStatus, string> = {
  Sold: "bg-unit-sold border-unit-sold-border",
  Available: "bg-unit-available-fill border-unit-available-border",
  Reserved: "bg-unit-reserved-fill border-unit-reserved-border",
  "On Hold": "bg-unit-hold-fill border-unit-hold-border",
  Unavailable: "bg-unit-unavailable-fill border-unit-unavailable-border",
};

const BACKEND_TO_DISPLAY_STATUS: Record<UnitRow["status"], UnitStatus> = {
  available: "Available",
  reserved: "Reserved",
  sold: "Sold",
  "on-hold": "On Hold",
  unavailable: "Unavailable",
};

export interface RealUnit extends UnitCellData {
  status: UnitStatus;
  floor: number;
  areaSqm: number;
  basePriceEgp: number;
  buildingId: string;
  buildingKey: string;
  buildingName: string;
  projectId: string;
  projectName: string;
  currentCustomerId: string | null;
  currentAgentId: string | null;
}

/**
 * The building-tabs + color-legend + floor-by-floor unit grid block, shared between the standalone
 * Units page (`/units`) and the Project Detail → Inventory tab — now backed by real
 * `GET /realestate/buildings` + `GET /realestate/units`, grouped client-side by building then floor
 * (highest first, the usual real-building convention). The backend owns unit generation (see
 * `unit.domain.ts`'s `unitAt()`), not this component.
 */
export function BuildingInventory({ projectId, onUnitClick }: { projectId: string; onUnitClick: (unit: RealUnit) => void }) {
  const buildings = useBuildings(projectId);
  const units = useUnits({ projectId });
  const projects = useProjectDirectory();
  const [buildingKey, setBuildingKey] = useState<string | undefined>(undefined);

  const grouped = useMemo(() => {
    const projectName = projects.byId.get(projectId) ?? projectId;
    return (buildings.data ?? []).map((b) => {
      const buildingUnits: RealUnit[] = (units.data ?? [])
        .filter((u) => u.buildingId === b.id)
        .map((u) => ({
          id: u.id,
          code: u.code,
          type: u.unitType,
          status: BACKEND_TO_DISPLAY_STATUS[u.status],
          floor: u.floor,
          areaSqm: Number(u.areaSqm),
          basePriceEgp: u.basePriceEgp,
          buildingId: b.id,
          buildingKey: b.key,
          buildingName: b.name,
          projectId,
          projectName,
          currentCustomerId: u.currentCustomerId,
          currentAgentId: u.currentAgentId,
        }));
      const floorNumbers = [...new Set(buildingUnits.map((u) => u.floor))].sort((a, c) => c - a);
      const floors = floorNumbers.map((floor) => ({ floor, units: buildingUnits.filter((u) => u.floor === floor) }));
      return { building: b, floors, allUnits: buildingUnits };
    });
  }, [buildings.data, units.data, projects.byId, projectId]);

  if (buildings.isLoading || units.isLoading || projects.isLoading) return <RowsSkeleton rows={6} cols={4} />;
  if (buildings.error || units.error || projects.error) {
    const err = buildings.error ?? units.error ?? projects.error;
    return <ErrorState title="Couldn't load inventory" message={err instanceof ApiError ? err.message : "The request failed."} />;
  }

  const active = grouped.find((b) => b.building.key === buildingKey) ?? grouped[0];

  if (grouped.length === 0 || !active) {
    return <EmptyState icon="building" title="No buildings for this project" description="No buildings have been added to this project yet." />;
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {grouped.map((b) => (
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
        {active.floors.length === 0 ? (
          <EmptyState icon="unit" title="No units generated yet" description="Generate units for this building to populate the floor plate." />
        ) : (
          active.floors.map((f) => (
            <FloorRow key={f.floor} floor={`F${f.floor}`} units={f.units} onSelect={(u) => onUnitClick(f.units.find((gu) => gu.id === u.id)!)} />
          ))
        )}
      </Card>
    </div>
  );
}
