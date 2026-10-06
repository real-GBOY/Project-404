/** Analytics query and result shapes. */
import type { L10n } from "./common";

export interface AnalyticsContributor {
  kind: "report" | "visit" | "observation" | "action";
  id: string;
  ref: string;
  title: L10n | string;
  sub: string;
  value: string;
}

export interface AnalyticsKpi {
  key: string;
  value: number | null;
  unit: "pct" | "count";
  of?: number;
  contributors: AnalyticsContributor[];
}

export interface AnalyticsResult {
  range: { from: string; to: string; bucket: "day" | "week" | "month" };
  kpis: AnalyticsKpi[];
  trend: Array<{ label: string; avg: number | null; n: number }>;
  sections: Array<{ title: L10n; rate: number; nonCompliant: number; answered: number }>;
  sites: Array<{ project: L10n; site: L10n; avg: number | null; n: number }>;
  actionStages: Array<{ stage: string; n: number }>;
  guardBuckets: Array<{ bucket: "low" | "mid" | "high"; n: number }>;
  inspectors: Array<{
    id: string;
    name: L10n;
    done: number;
    missed: number;
    avg: number | null;
    returned: number;
  }>;
  repeated: Array<{ ref: string; id: string; title: L10n; site: L10n; times: number }>;
}

export interface AnalyticsQueryParams {
  period: string;
  from: string;
  to: string;
  projectId: string;
  siteId: string;
}
