import { useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { KanbanCard, KanbanColumn, type KanbanCardData } from "@/components/domain/kanban";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useToast } from "@/lib/toast/toast-provider";
import {
  STAGES,
  STAGE_COLORS,
  LEAD_STATUS_TO_STAGE,
  PIPELINE_EXTRA_LEADS,
  type StageKey,
} from "@/mocks/fixtures/pipeline-stages";
import { LEADS } from "@/mocks/fixtures/leads";

interface PipelineCard extends KanbanCardData {
  defaultStage: StageKey;
}

/**
 * Full pipeline population = LEADS (mapped status → stage via
 * `LEAD_STATUS_TO_STAGE`, defaulting to NEW) concatenated with the
 * further-along `PIPELINE_EXTRA_LEADS` (which already carry an explicit
 * stage) — see pipeline-stages.ts's derivation note.
 */
const ALL_CARDS: PipelineCard[] = [
  ...LEADS.map((l) => ({
    id: l.id,
    name: l.name,
    interest: l.interest,
    value: l.value,
    score: l.score,
    agent: l.agent,
    when: l.lastActivity,
    defaultStage: LEAD_STATUS_TO_STAGE[l.status] ?? "NEW",
  })),
  ...PIPELINE_EXTRA_LEADS.map((l) => ({
    id: l.id,
    name: l.name,
    interest: l.interest,
    value: l.value,
    score: l.score,
    agent: l.agent,
    when: l.lastActivity,
    defaultStage: l.stage,
  })),
];

/** Parses "EGP 5.4M" → 5.4 */
function parseValueM(value: string): number {
  const n = parseFloat(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Formats a summed EGP-millions number back to "EGP {sum}M", trimming trailing zeros. */
function formatEGPM(sum: number): string {
  const rounded = Math.round(sum * 100) / 100;
  const str = rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return `EGP ${str}M`;
}

export function PipelinePage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [overrides, setOverrides] = useState<Record<string, StageKey>>({});
  const [dragId, setDragId] = useState<string | null>(null);

  const columns = useMemo(() => {
    const stageOf = (card: PipelineCard): StageKey => overrides[card.id] ?? card.defaultStage;
    return STAGES.map((stage) => {
      const cards = ALL_CARDS.filter((c) => stageOf(c) === stage);
      const total = cards.reduce((sum, c) => sum + parseValueM(c.value), 0);
      return { stage, cards, total };
    });
  }, [overrides]);

  function handleDrop(stage: StageKey) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain") || dragId;
      if (id) setOverrides((prev) => ({ ...prev, [id]: stage }));
      setDragId(null);
    };
  }

  async function handleNewDeal() {
    const ok = await confirm({
      title: "New Deal",
      body: "This is a mock action — no backend is connected yet.",
      cta: "Create Deal",
    });
    if (ok) toast.push({ kind: "success", title: "Deal created", body: "Added to the New stage." });
  }

  return (
    <PageContainer>
      <PageHeader
        title="Pipeline"
        description="84 open deals · EGP 1.86B weighted pipeline"
        actions={
          <Button size="sm" icon="plus" onClick={handleNewDeal}>
            New Deal
          </Button>
        }
      />

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map(({ stage, cards, total }) => (
          <KanbanColumn
            key={stage}
            label={stage}
            color={STAGE_COLORS[stage]}
            count={cards.length}
            value={formatEGPM(total)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop(stage)}
          >
            {cards.map((card) => (
              <KanbanCard
                key={card.id}
                card={card}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", card.id);
                  setDragId(card.id);
                }}
              />
            ))}
          </KanbanColumn>
        ))}
      </div>
    </PageContainer>
  );
}
