import type { ReactNode } from "react";
import type { DataColumn } from "@/components/tables/data-table";
import type { KpiTileProps } from "@/components/ui/kpi-tile";
import type { QuickCreateConfig } from "@/components/tables/quick-create-modal";

/**
 * The 21 routes that all render the SAME generic `EntityTablePage` (mirrors
 * the design's `TABLES()`-keyed `isTable` screen — PLAN §3, screen #2).
 */
export type EntityKey =
  | "leads"
  | "customers"
  | "activities"
  | "followups"
  | "projects"
  | "buildings"
  | "availability"
  | "pricing"
  | "reservations"
  | "deals"
  | "contracts"
  | "commissions"
  | "payments"
  | "installments"
  | "collections"
  | "outstanding"
  | "finreports"
  | "tasks"
  | "audit"
  | "team"
  | "roles";

export interface TableConfig<T = unknown> {
  title: string;
  subtitle: string;
  primaryAction?: string;
  columns: DataColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => string | void;
  kpis?: Omit<KpiTileProps, "compact">[];
  filters?: string[];
  searchPlaceholder?: string;
  /** field getter(s) the free-text search box matches against */
  searchText: (row: T) => string;
  emptyTitle?: string;
  emptyWhy: string;
  minWidth?: number;
  /** rendered instead of the primary action button, if a screen needs something custom */
  headerExtra?: ReactNode;
  /**
   * When set, `primaryAction` opens this small form modal instead of the
   * plain yes/no confirm dialog — for actions that need real input (New
   * Lead, Reserve Unit, …). When absent, `onConfirmAction` (a zero-input
   * mutation, e.g. "Generate Units") drives the plain confirm dialog.
   */
  createForm?: QuickCreateConfig;
  onConfirmAction?: () => Promise<void>;
}

/** Wraps a domain's `TableConfig` with the async state driving it — EntityTablePage renders
 *  skeleton/error states from this instead of treating "not loaded yet" as "not registered". */
export interface TableConfigResult<T = unknown> {
  config: TableConfig<T> | undefined;
  isLoading: boolean;
  error: unknown;
}

/** Type-erased for the heterogeneous registry map; each domain file still builds a fully-typed
 *  `TableConfig<SomeFixtureRow>` — only the shared map needs `any`. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTableConfig = TableConfig<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTableConfigResult = TableConfigResult<any>;

/** Each domain module registers its own slice; `entity-table-registry.ts` merges them. */
export type TableConfigRegistry = Partial<Record<EntityKey, AnyTableConfig>>;
