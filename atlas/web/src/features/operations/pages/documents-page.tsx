import { useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/feedback/empty-state";
import { DocumentCard, type DocumentItem } from "@/components/domain/document-card";
import { useToast } from "@/lib/toast/toast-provider";
import { DOCUMENTS, type DocumentFixture } from "@/mocks/fixtures/documents";

interface Category {
  label: string;
  test: (d: DocumentFixture) => boolean;
}

const CATEGORIES: Category[] = [
  { label: "All files", test: () => true },
  { label: "Contracts", test: (d) => d.type === "Contract" },
  { label: "KYC", test: (d) => d.type.startsWith("KYC") },
  { label: "Payment proofs", test: (d) => d.type === "Payment proof" },
  { label: "Drawings", test: (d) => d.type === "Drawing" },
  { label: "Awaiting verification", test: (d) => d.status === "Pending" },
];

function toDocumentItem(d: DocumentFixture): DocumentItem {
  const ext = d.name.split(".").pop()?.toUpperCase() ?? "FILE";
  return {
    id: d.name,
    name: d.name,
    type: `${ext} · ${d.type}`,
    owner: d.owner,
    size: d.size,
    date: d.date,
    status: d.status,
  };
}

/**
 * Operations → Documents (PLAN §3 item 12, `isDocs`). Filter chip row over a
 * card-grid of the document register — the denser doc-row variant used
 * inside Customer 360 / the unit drawer is a different component and out of
 * scope here.
 */
export function DocumentsPage() {
  const toast = useToast();
  const [active, setActive] = useState<string>(CATEGORIES[0].label);

  const counts = useMemo(
    () => Object.fromEntries(CATEGORIES.map((c) => [c.label, DOCUMENTS.filter(c.test).length])),
    [],
  );

  const filtered = useMemo(() => {
    const category = CATEGORIES.find((c) => c.label === active) ?? CATEGORIES[0];
    return DOCUMENTS.filter(category.test);
  }, [active]);

  const pending = counts["Awaiting verification"] ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Documents"
        description={`${DOCUMENTS.length} files · ${pending} awaiting verification · contracts, KYC, payment proofs and drawings across every deal`}
        actions={
          <Button variant="secondary" size="sm" icon="download">
            Export
          </Button>
        }
        below={
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <Chip key={c.label} active={active === c.label} activeVariant="pale" count={counts[c.label]} onClick={() => setActive(c.label)}>
                {c.label}
              </Chip>
            ))}
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon="doc"
          title="No files in this category"
          description="Files are attached automatically when a KYC document, signed contract, payment proof or drawing is uploaded against a customer, unit or payment record."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
          {filtered.map((d) => (
            <DocumentCard
              key={d.name}
              doc={toDocumentItem(d)}
              onClick={() => toast.push({ kind: "info", title: "Preview not available in this mock", body: d.name })}
            />
          ))}
        </div>
      )}
    </PageContainer>
  );
}
