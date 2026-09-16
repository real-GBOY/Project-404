import type { AnyTableConfigResult, EntityKey, TableQueryParams } from "./table-types";
import { useLeadsTableConfig, useCustomersTableConfig, useActivitiesTableConfig, useFollowupsTableConfig } from "@/features/crm/table-configs";
import { useProjectsTableConfig, useBuildingsTableConfig, useAvailabilityTableConfig, usePricingTableConfig } from "@/features/properties/table-configs";
import { useReservationsTableConfig, useDealsTableConfig, useContractsTableConfig, useCommissionsTableConfig } from "@/features/sales/table-configs";
import { usePaymentsTableConfig, useInstallmentsTableConfig, useCollectionsTableConfig, useOutstandingTableConfig, useFinreportsTableConfig } from "@/features/finance/table-configs";
import { useTasksTableConfig } from "@/features/operations/table-configs";
import { useTeamTableConfig, useRolesTableConfig, useAuditTableConfig } from "@/features/admin/table-configs";

// `entity` never changes across re-renders of a single mounted EntityTablePage instance:
// EntityTablePage keys its real implementation on `entity` (see entity-table-page.tsx),
// forcing a fresh mount whenever it changes, since React Router reconciles sibling
// EntityTablePage routes as updates of the SAME instance otherwise (they all render
// through one <Outlet/>) — without that key, this switch would call a different hook
// on an existing instance mid-navigation, a real Rules-of-Hooks violation, not just a
// lint false-positive. With the key in place, exactly one branch's hook ever runs for
// a given instance's whole lifetime, so disabling the lint rule here is safe.
/* eslint-disable react-hooks/rules-of-hooks */
export function useTableConfig(entity: EntityKey, params: TableQueryParams): AnyTableConfigResult {
  switch (entity) {
    case "leads":
      return useLeadsTableConfig(params) as AnyTableConfigResult;
    case "customers":
      return useCustomersTableConfig(params) as AnyTableConfigResult;
    case "activities":
      return useActivitiesTableConfig(params) as AnyTableConfigResult;
    case "followups":
      return useFollowupsTableConfig(params) as AnyTableConfigResult;
    case "projects":
      return useProjectsTableConfig(params) as AnyTableConfigResult;
    case "buildings":
      return useBuildingsTableConfig(params) as AnyTableConfigResult;
    case "availability":
      return useAvailabilityTableConfig(params) as AnyTableConfigResult;
    case "pricing":
      return usePricingTableConfig(params) as AnyTableConfigResult;
    case "reservations":
      return useReservationsTableConfig(params) as AnyTableConfigResult;
    case "deals":
      return useDealsTableConfig(params) as AnyTableConfigResult;
    case "contracts":
      return useContractsTableConfig(params) as AnyTableConfigResult;
    case "commissions":
      return useCommissionsTableConfig(params) as AnyTableConfigResult;
    case "payments":
      return usePaymentsTableConfig(params) as AnyTableConfigResult;
    case "installments":
      return useInstallmentsTableConfig(params) as AnyTableConfigResult;
    case "collections":
      return useCollectionsTableConfig(params) as AnyTableConfigResult;
    case "outstanding":
      return useOutstandingTableConfig(params) as AnyTableConfigResult;
    case "finreports":
      return useFinreportsTableConfig(params) as AnyTableConfigResult;
    case "tasks":
      return useTasksTableConfig(params) as AnyTableConfigResult;
    case "team":
      return useTeamTableConfig(params) as AnyTableConfigResult;
    case "roles":
      return useRolesTableConfig(params) as AnyTableConfigResult;
    case "audit":
      return useAuditTableConfig(params) as AnyTableConfigResult;
  }
}
/* eslint-enable react-hooks/rules-of-hooks */
