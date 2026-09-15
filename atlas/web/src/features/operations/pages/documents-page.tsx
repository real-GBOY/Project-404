import { useMemo, useState } from "react";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { RowsSkeleton } from "@/components/feedback/skeleton";
import { DocumentCard, type DocumentItem } from "@/components/domain/document-card";
import { QuickCreateModal } from "@/components/tables/quick-create-modal";
import { useToast } from "@/lib/toast/toast-provider";
import { formatDate } from "@/lib/time";
import { titleCase } from "@/lib/text";
import { ApiError } from "@/config";
import { useAuth } from "@/features/auth/auth-provider";
import { useTeamDirectory } from "@/api/team";
import { useDocuments, useCreateDocument, type DocumentRow } from "@/api/operations";

interface Category {
  label: string;
  test: (d: DocumentRow) => boolean;
}

const CATEGORIES: Category[] = [
  { label: "All files", test: () => true },
  { label: "Contracts", test: (d) => d.docType === "contract" },
  { label: "KYC", test: (d) => d.docType === "kyc" },
  { label: "Payment proofs", test: (d) => d.docType === "payment-proof" },
  { label: "Drawings", test: (d) => d.docType === "drawing" },
  { label: "Awaiting verification", test: (d) => d.status === "pending" },
];

function toDocumentItem(d: DocumentRow, ownerName: (id: string) => string): DocumentItem {
  const ext = d.name.split(".").pop()?.toUpperCase() ?? "FILE";
  return {
    id: d.id,
    name: d.name,
    type: `${ext} · ${titleCase(d.docType)}`,
    owner: ownerName(d.uploadedBy),
    size: "—",
    date: formatDate(d.createdAt),
    status: titleCase(d.status),
  };
}

/**
 * Operations → Documents. Filter chip row over a card-grid of the document
 * register, backed by real `realestate_documents` rows.
 */
export function DocumentsPage() {
  const toast = useToast();
  const { data, isLoading, error } = useDocuments();
  const team = useTeamDirectory();
  const createDocument = useCreateDocument();
  const auth = useAuth();
  const [active, setActive] = useState<string>(CATEGORIES[0].label);
  const [uploadOpen, setUploadOpen] = useState(false);

  const documents = useMemo(() => data ?? [], [data]);

  const counts = useMemo(() => Object.fromEntries(CATEGORIES.map((c) => [c.label, documents.filter(c.test).length])), [documents]);
  const filtered = useMemo(() => {
    const category = CATEGORIES.find((c) => c.label === active) ?? CATEGORIES[0];
    return documents.filter(category.test);
  }, [documents, active]);

  if (isLoading || team.isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Documents" />
        <RowsSkeleton rows={6} cols={4} />
      </PageContainer>
    );
  }

  if (error || team.error) {
    return (
      <PageContainer>
        <PageHeader title="Documents" />
        <ErrorState title="Couldn't load documents" message={error instanceof ApiError ? error.message : "The request failed."} />
      </PageContainer>
    );
  }

  const pending = counts["Awaiting verification"] ?? 0;

  return (
    <PageContainer>
      <PageHeader
        title="Documents"
        description={`${documents.length} files · ${pending} awaiting verification`}
        actions={
          <Button size="sm" icon="plus" onClick={() => setUploadOpen(true)}>
            Register Document
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
          description="Files are attached when a KYC document, signed contract, payment proof or drawing is registered against a customer, unit or payment record."
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
          {filtered.map((d) => (
            <DocumentCard
              key={d.id}
              doc={toDocumentItem(d, (id) => team.byId.get(id) ?? id)}
              onClick={() => toast.push({ kind: "info", title: "Preview not available yet", body: d.name })}
            />
          ))}
        </div>
      )}

      <QuickCreateModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        config={{
          title: "Register Document",
          description: "Registers a document record without an attached file (file upload isn't wired to this form yet).",
          submitLabel: "Register",
          fields: [
            { name: "name", label: "File Name", required: true, placeholder: "e.g. Contract C-0193 signed.pdf" },
            {
              name: "docType",
              label: "Type",
              type: "select",
              required: true,
              defaultValue: "contract",
              options: [
                { value: "contract", label: "Contract" },
                { value: "kyc", label: "KYC" },
                { value: "payment-proof", label: "Payment Proof" },
                { value: "drawing", label: "Drawing" },
                { value: "other", label: "Other" },
              ],
            },
          ],
          onSubmit: async (values) => {
            await createDocument.mutateAsync({ name: values.name, docType: values.docType, uploadedBy: auth.user?.id ?? "" });
          },
        }}
      />
    </PageContainer>
  );
}
