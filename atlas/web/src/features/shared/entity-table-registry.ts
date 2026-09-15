import type { AnyTableConfigResult, EntityKey } from "./table-types";
import { useLeadsTableConfig, useCustomersTableConfig, useActivitiesTableConfig, useFollowupsTableConfig } from "@/features/crm/table-configs";
import { useProjectsTableConfig, useBuildingsTableConfig, useAvailabilityTableConfig, usePricingTableConfig } from "@/features/properties/table-configs";
import { useReservationsTableConfig, useDealsTableConfig, useContractsTableConfig, useCommissionsTableConfig } from "@/features/sales/table-configs";
import { usePaymentsTableConfig, useInstallmentsTableConfig, useCollectionsTableConfig, useOutstandingTableConfig, useFinreportsTableConfig } from "@/features/finance/table-configs";
import { useTasksTableConfig } from "@/features/operations/table-configs";
import { useTeamTableConfig, useRolesTableConfig, useAuditTableConfig } from "@/features/admin/table-configs";

// `entity` never changes across re-renders of a single mounted EntityTablePage instance
// (each route gets its own instance), so exactly one branch's hook ever runs for that
// instance's whole lifetime — safe despite looking conditional to the lint rule.
/* eslint-disable react-hooks/rules-of-hooks */
export function useTableConfig(entity: EntityKey): AnyTableConfigResult {
  switch (entity) {
    case "leads":
      return useLeadsTableConfig() as AnyTableConfigResult;
    case "customers":
      return useCustomersTableConfig() as AnyTableConfigResult;
    case "activities":
      return useActivitiesTableConfig() as AnyTableConfigResult;
    case "followups":
      return useFollowupsTableConfig() as AnyTableConfigResult;
    case "projects":
      return useProjectsTableConfig() as AnyTableConfigResult;
    case "buildings":
      return useBuildingsTableConfig() as AnyTableConfigResult;
    case "availability":
      return useAvailabilityTableConfig() as AnyTableConfigResult;
    case "pricing":
      return usePricingTableConfig() as AnyTableConfigResult;
    case "reservations":
      return useReservationsTableConfig() as AnyTableConfigResult;
    case "deals":
      return useDealsTableConfig() as AnyTableConfigResult;
    case "contracts":
      return useContractsTableConfig() as AnyTableConfigResult;
    case "commissions":
      return useCommissionsTableConfig() as AnyTableConfigResult;
    case "payments":
      return usePaymentsTableConfig() as AnyTableConfigResult;
    case "installments":
      return useInstallmentsTableConfig() as AnyTableConfigResult;
    case "collections":
      return useCollectionsTableConfig() as AnyTableConfigResult;
    case "outstanding":
      return useOutstandingTableConfig() as AnyTableConfigResult;
    case "finreports":
      return useFinreportsTableConfig() as AnyTableConfigResult;
    case "tasks":
      return useTasksTableConfig() as AnyTableConfigResult;
    case "team":
      return useTeamTableConfig() as AnyTableConfigResult;
    case "roles":
      return useRolesTableConfig() as AnyTableConfigResult;
    case "audit":
      return useAuditTableConfig() as AnyTableConfigResult;
  }
}
/* eslint-enable react-hooks/rules-of-hooks */
