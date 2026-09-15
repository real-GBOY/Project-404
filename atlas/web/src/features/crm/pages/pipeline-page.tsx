import { useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { KanbanCard, KanbanColumn, type KanbanCardData } from "@/components/domain/kanban";
import { QuickCreateModal } from "@/components/tables/quick-create-modal";
import { useToast } from "@/lib/toast/toast-provider";
import { formatEgp } from "@/lib/money";
import { timeAgo } from "@/lib/time";
import { ApiError } from "@/lib/api/client";
import { useAuth } from "@/features/auth/auth-provider";
import { useTeamDirectory } from "@/api/team";
import { useLeads, useCreateLead, useUpdateLead, type LeadStage, type LeadSource } from "@/api/crm";
import { STAGES, STAGE_COLORS } from "@/mocks/fixtures/pipeline-stages";

interface PipelineCard extends KanbanCardData {
  stage: LeadStage;
}

export function PipelinePage() {
  const { data, isLoading, error } = useLeads();
  const team = useTeamDirectory();
  const updateLead = useUpdateLead();
  const createLead = useCreateLead();
  const auth = useAuth();
  const toast = useToast();
  const [dragId, setDragId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const cards: PipelineCard[] = useMemo(
    () =>
      (data ?? []).map((l) => ({
        id: l.id,
        name: l.name,
        interest: l.interestText ?? "—",
        value: formatEgp(l.valueEgp),
        score: l.score,
        agent: team.byId.get(l.agentId) ?? l.agentId,
        when: timeAgo(l.lastActivityAt),
        stage: l.stage,
      })),
    [data, team.byId],
  );

  const columns = useMemo(
    () =>
      STAGES.map((stage) => {
        const stageCards = cards.filter((c) => c.stage.toUpperCase() === stage);
        const totalM = stageCards.reduce((sum, c) => sum + (parseFloat(c.value.replace(/[^0-9.]/g, "")) || 0), 0);
        return { stage, cards: stageCards, totalM };
      }),
    [cards],
  );

  if (isLoading || team.isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Pipeline" />
        <RowsSkeleton rows={8} cols={4} />
      </PageContainer>
    );
  }

  if (error || team.error) {
    return (
      <PageContainer>
        <PageHeader title="Pipeline" />
        <ErrorState title="Couldn't load the pipeline" message={error instanceof ApiError ? error.message : "The request failed."} />
      </PageContainer>
    );
  }

  function handleDrop(stage: (typeof STAGES)[number]) {
    return async (e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/plain") || dragId;
      setDragId(null);
      if (!id) return;
      try {
        await updateLead.mutateAsync({ id, body: { stage: stage.toLowerCase() as LeadStage } });
      } catch (err) {
        toast.push({ kind: "danger", title: "Couldn't move lead", body: err instanceof ApiError ? err.message : "Something went wrong." });
      }
    };
  }

  const openDeals = cards.filter((c) => c.stage !== "lost" && c.stage !== "sold").length;
  const weightedValueM = columns.reduce((sum, c) => sum + c.totalM, 0);

  return (
    <PageContainer>
      <PageHeader
        title="Pipeline"
        description={`${openDeals} open deals · EGP ${weightedValueM.toFixed(1)}M pipeline value`}
        actions={
          <Button size="sm" icon="plus" onClick={() => setCreateOpen(true)}>
            New Lead
          </Button>
        }
      />

      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map(({ stage, cards: stageCards, totalM }) => (
          <KanbanColumn
            key={stage}
            label={stage}
            color={STAGE_COLORS[stage]}
            count={stageCards.length}
            value={`EGP ${totalM.toFixed(1)}M`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop(stage)}
          >
            {stageCards.map((card) => (
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

      <QuickCreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        config={{
          title: "New Lead",
          submitLabel: "Create Lead",
          fields: [
            { name: "name", label: "Name", required: true, placeholder: "Full name" },
            { name: "phone", label: "Phone", required: true, placeholder: "+20 1xx xxx xxxx" },
            {
              name: "source",
              label: "Source",
              type: "select",
              required: true,
              defaultValue: "website",
              options: ["referral", "website", "facebook", "broker", "exhibition", "instagram"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })),
            },
            { name: "agentId", label: "Agent", type: "select", required: true, defaultValue: auth.user?.id, options: team.members.map((m) => ({ value: m.id, label: m.name })) },
            { name: "interestText", label: "Interest", placeholder: "e.g. North Hills · A-0904" },
            { name: "valueEgp", label: "Deal Value (EGP)", type: "number", placeholder: "5400000" },
          ],
          onSubmit: async (values) => {
            await createLead.mutateAsync({
              name: values.name,
              phone: values.phone,
              source: values.source as LeadSource,
              agentId: values.agentId,
              interestText: values.interestText || null,
              valueEgp: values.valueEgp ? Number(values.valueEgp) : undefined,
            });
          },
        }}
      />
    </PageContainer>
  );
}
