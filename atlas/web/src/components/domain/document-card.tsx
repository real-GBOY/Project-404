import { Icon } from "@/components/ui/icon";
import { StatusBadge } from "@/components/ui/pill";

export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  owner: string;
  size: string;
  date: string;
  status: string;
}

export function DocumentCard({ doc, onClick }: { doc: DocumentItem; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col overflow-hidden rounded-card border border-border bg-surface text-start transition-colors hover:border-faint"
    >
      <div
        className="flex h-[74px] items-center justify-center border-b border-border-row text-faint"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, var(--color-surface-subtle-2), var(--color-surface-subtle-2) 6px, transparent 6px, transparent 12px)",
        }}
      >
        <Icon name="doc" size={22} />
      </div>
      <div className="p-2.5">
        <div className="truncate text-[11.5px] font-semibold">{doc.name}</div>
        <div className="mt-0.5 truncate text-[10px] text-subtle">
          {doc.type} · {doc.owner}
        </div>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="text-[9.5px] text-subtle">
            {doc.size} · {doc.date}
          </span>
          <StatusBadge status={doc.status} />
        </div>
      </div>
    </button>
  );
}
