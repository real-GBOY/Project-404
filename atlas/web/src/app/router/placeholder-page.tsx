import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/feedback/empty-state";

/** Temporary stand-in for a route not yet wired to its real feature page. */
export function PlaceholderPage({ title }: { title: string }) {
  return (
    <PageContainer>
      <PageHeader title={title} />
      <EmptyState icon="clock" title="Coming online" description="This screen is being built out." />
    </PageContainer>
  );
}
