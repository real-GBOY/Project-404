import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InsightCard } from "@/components/domain/insight-card";
import { useConfirm } from "@/lib/confirm/confirm-provider";
import { useToast } from "@/lib/toast/toast-provider";
import { toneFromHex } from "@/lib/hex-tone";
import { INSIGHTS_FEED } from "@/mocks/fixtures/ai-insights";

const COPY: Record<"insights" | "recos", { title: string; subtitle: string }> = {
  insights: {
    title: "AI Insights",
    subtitle: "Generated every hour from sales, inventory, lead and payment data",
  },
  recos: {
    title: "Recommendations",
    subtitle: "Actions Atlas proposes from live portfolio data · every action is reviewed before it runs",
  },
};

/**
 * `isFeed` screen (PLAN §3.13) — same 5-item feed backs both /insights and
 * /recommendations, only the header copy differs. Wide cards, each split
 * into main content + a right-hand "Recommended action" sidebar panel
 * (the `InsightCard` `sidebar` skin) rather than the dashboard's inline
 * CTA/Dismiss button pair.
 */
export function FeedPage({ kind }: { kind: "insights" | "recos" }) {
  const confirm = useConfirm();
  const toast = useToast();
  const copy = COPY[kind];

  async function handleAct(cta: string, title: string, body: string) {
    const ok = await confirm({
      title: `${cta}?`,
      body: `${title}. ${body} Atlas will apply this action and record it in the audit log.`,
      cta: "Run action",
    });
    if (ok) toast.push({ kind: "success", title: "Action applied", body: cta });
  }

  return (
    <PageContainer>
      <PageHeader title={copy.title} description={copy.subtitle} />

      <div className="flex flex-col gap-3">
        {INSIGHTS_FEED.map((item) => (
          <Card key={item.title}>
            <InsightCard
              insight={{
                id: item.title,
                tag: item.tag,
                tagTone: toneFromHex(item.tagFg),
                confidence: item.confidence.replace("confidence ", ""),
                text: item.title,
                detail: item.body,
                cta: item.cta,
              }}
              sidebar={
                <>
                  <Button size="sm" onClick={() => handleAct(item.cta, item.title, item.body)}>
                    {item.cta}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => toast.push({ title: "Insight dismissed" })}>
                    Dismiss
                  </Button>
                </>
              }
            />
          </Card>
        ))}
      </div>
    </PageContainer>
  );
}
