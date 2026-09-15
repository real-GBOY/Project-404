import { useNavigate } from "react-router-dom";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InsightCard } from "@/components/domain/insight-card";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { ErrorState } from "@/components/feedback/error-state";
import { EmptyState } from "@/components/feedback/empty-state";
import { useToast } from "@/lib/toast/toast-provider";
import { toneOf } from "@/lib/tone";
import { ApiError } from "@/lib/api/client";
import { useInsights, useDismissInsight } from "@/api/dashboard";

const COPY: Record<"insights" | "recos", { title: string; subtitle: string }> = {
  insights: {
    title: "AI Insights",
    subtitle: "Generated from live sales, inventory, lead and payment data",
  },
  recos: {
    title: "Recommendations",
    subtitle: "Actions Atlas proposes from live portfolio data · every action is reviewed before it runs",
  },
};

/**
 * `isFeed` screen — same feed (kind="feed") backs both /insights and
 * /recommendations, only the header copy differs. Wide cards, each split
 * into main content + a right-hand "Recommended action" sidebar panel.
 */
export function FeedPage({ kind }: { kind: "insights" | "recos" }) {
  const navigate = useNavigate();
  const toast = useToast();
  const copy = COPY[kind];
  const { data, isLoading, error } = useInsights("feed");
  const dismiss = useDismissInsight();

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title={copy.title} description={copy.subtitle} />
        <RowsSkeleton rows={4} cols={1} />
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <PageHeader title={copy.title} description={copy.subtitle} />
        <ErrorState title="Couldn't load insights" message={error instanceof ApiError ? error.message : "The request failed."} />
      </PageContainer>
    );
  }

  const items = data ?? [];

  return (
    <PageContainer>
      <PageHeader title={copy.title} description={copy.subtitle} />

      {items.length === 0 ? (
        <Card>
          <EmptyState icon="insight" title="No insights right now" description="New insights are generated from live sales, inventory, lead and payment data as it changes." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <InsightCard
                insight={{
                  id: item.id,
                  tag: item.tag,
                  tagTone: toneOf(item.tag),
                  confidence: item.confidence,
                  text: item.text,
                  detail: item.detail,
                  cta: item.cta,
                }}
                sidebar={
                  <>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (item.targetRoute) navigate(`/${item.targetRoute.replace("an_", "analytics/")}`);
                        else toast.push({ kind: "info", title: "No automated action yet", body: "This insight doesn't have a wired action yet." });
                      }}
                    >
                      {item.cta}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        dismiss.mutate(item.id);
                        toast.push({ title: "Insight dismissed" });
                      }}
                    >
                      Dismiss
                    </Button>
                  </>
                }
              />
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
