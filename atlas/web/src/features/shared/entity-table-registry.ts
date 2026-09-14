import type { AnyTableConfig, EntityKey } from "./table-types";
import { crmTableConfigs } from "@/features/crm/table-configs";
import { propertiesTableConfigs } from "@/features/properties/table-configs";
import { salesTableConfigs } from "@/features/sales/table-configs";
import { financeTableConfigs } from "@/features/finance/table-configs";
import { operationsTableConfigs } from "@/features/operations/table-configs";
import { adminTableConfigs } from "@/features/admin/table-configs";

const REGISTRY: Partial<Record<EntityKey, AnyTableConfig>> = {
  ...crmTableConfigs,
  ...propertiesTableConfigs,
  ...salesTableConfigs,
  ...financeTableConfigs,
  ...operationsTableConfigs,
  ...adminTableConfigs,
};

export function getTableConfig(entity: EntityKey): AnyTableConfig | undefined {
  return REGISTRY[entity];
}
