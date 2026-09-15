// Pure display config for the Pipeline Kanban board — stage keys and their colors. Board contents
// (cards, totals) come from the real `realestate_leads.stage` column now, not mock data.

import { DATAVIZ_COLORS } from "@/styles/colors";

export const STAGES = [
  'NEW', 'QUALIFIED', 'CONTACTED', 'VIEWING', 'NEGOTIATION', 'RESERVED', 'CONTRACTED', 'SOLD', 'LOST',
] as const;

export type StageKey = (typeof STAGES)[number];

export const STAGE_COLORS: Record<StageKey, string> = {
  NEW: DATAVIZ_COLORS.pipelineStage.new,
  QUALIFIED: DATAVIZ_COLORS.pipelineStage.qualified,
  CONTACTED: DATAVIZ_COLORS.pipelineStage.contacted,
  VIEWING: DATAVIZ_COLORS.pipelineStage.viewing,
  NEGOTIATION: DATAVIZ_COLORS.pipelineStage.negotiation,
  RESERVED: DATAVIZ_COLORS.pipelineStage.reserved,
  CONTRACTED: DATAVIZ_COLORS.pipelineStage.contracted,
  SOLD: DATAVIZ_COLORS.pipelineStage.sold,
  LOST: DATAVIZ_COLORS.pipelineStage.lost,
};
