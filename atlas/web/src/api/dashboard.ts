import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { get, post, ENDPOINTS } from "@/config";

export interface DashboardProjectSummary {
  id: string;
  name: string;
  soldUnits: number;
  totalUnits: number;
  revenueEgp: number;
  velocityPerWeek: string;
  sellThroughPct: string;
}

export interface DashboardAvailability {
  projectId: string;
  unitType: string;
  available: number;
  reserved: number;
  sold: number;
  priceFromEgp: number;
}

export interface DashboardFunnelStage {
  stage: string;
  count: number;
}

export interface DashboardActivity {
  id: string;
  type: string;
  subject: string;
  relatedType: string | null;
  relatedId: string | null;
  agentId: string;
  outcome: string | null;
  occurredAt: string;
}

export interface DashboardCollectionRow {
  projectId: string;
  dueEgp: number;
  collectedEgp: number;
  overdueEgp: number;
  accounts: number;
  collectionRatePct: number;
}

export interface DashboardSummary {
  projectCount: number;
  totalUnits: number;
  soldUnits: number;
  reservedUnits: number;
  availableUnits: number;
  totalValueEgp: number;
  revenueEgp: number;
  projects: DashboardProjectSummary[];
  inventoryByType: DashboardAvailability[];
  leadFunnel: DashboardFunnelStage[];
  recentActivity: DashboardActivity[];
  collectionsByProject: DashboardCollectionRow[];
}

export function useDashboardSummary() {
  return useQuery({ queryKey: ["dashboard"], queryFn: () => get<DashboardSummary>(ENDPOINTS.dashboard) });
}

// ---------- AI insights ----------

export type InsightKind = "dashboard" | "feed";

export interface InsightRow {
  id: string;
  kind: InsightKind;
  tag: string;
  confidence: string;
  text: string;
  detail: string;
  cta: string;
  targetRoute: string | null;
  dismissedBy: string | null;
  dismissedAt: string | null;
}

export function useInsights(kind: InsightKind) {
  return useQuery({ queryKey: ["insights", kind], queryFn: () => get<InsightRow[]>(ENDPOINTS.insights.list, { kind }) });
}

export function useDismissInsight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => post<void>(ENDPOINTS.insights.dismiss(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["insights"] }),
  });
}
