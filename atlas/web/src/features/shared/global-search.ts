import { useMemo } from "react";
import type { CommandResult } from "@/components/navigation/command-palette";
import { formatEgp } from "@/lib/money";
import { titleCase } from "@/lib/text";
import { useUnits, useProjectDirectory } from "@/api/properties";
import { useCustomers, useLeads } from "@/api/crm";
import { useContracts } from "@/api/sales";
import { usePayments } from "@/api/finance";
import { useDocuments } from "@/api/operations";

const GROUP_ICON: Record<string, string> = {
  Units: "unit",
  Customers: "customer",
  Leads: "lead",
  Projects: "project",
  "Contracts & Payments": "payment",
  Documents: "doc",
};

interface IndexEntry {
  /** A stable unique id for this row — never the display title, which can
   *  repeat (unit codes recur per project/building, names can collide) and
   *  would otherwise give React duplicate list keys, corrupting which row
   *  renders which content. */
  id: string;
  group: string;
  title: string;
  subtitle: string;
  meta: string;
  targetRoute: string;
}

/**
 * ⌘K omnisearch across units, customers, leads, projects, contracts &
 * payments, and documents — reads from the same React Query caches those
 * screens already populate (near-zero extra cost; no per-keystroke fetch).
 */
export function useGlobalSearch(navigate: (to: string) => void): (query: string) => CommandResult[] {
  const units = useUnits();
  const projects = useProjectDirectory();
  const customers = useCustomers();
  const leads = useLeads();
  const contracts = useContracts();
  const payments = usePayments();
  const documents = useDocuments();

  const index = useMemo<IndexEntry[]>(() => {
    const entries: IndexEntry[] = [];

    for (const u of units.data ?? []) {
      entries.push({ id: u.id, group: "Units", title: u.code, subtitle: `${projects.byId.get(u.projectId) ?? u.projectId} · ${u.unitType}`, meta: titleCase(u.status), targetRoute: "units" });
    }
    for (const c of customers.data ?? []) {
      entries.push({ id: c.id, group: "Customers", title: c.name, subtitle: `${c.id} · ${c.unitsOwned} unit${c.unitsOwned === 1 ? "" : "s"} · ${formatEgp(c.portfolioEgp)}`, meta: titleCase(c.status), targetRoute: `customers/${c.id}` });
    }
    for (const l of leads.data ?? []) {
      entries.push({ id: l.id, group: "Leads", title: l.name, subtitle: `${l.id} · ${titleCase(l.stage)} · score ${l.score}`, meta: titleCase(l.status), targetRoute: "leads" });
    }
    for (const [id, name] of projects.byId.entries()) {
      entries.push({ id, group: "Projects", title: name, subtitle: name, meta: "Project", targetRoute: `projects/${id}` });
    }
    for (const c of contracts.data ?? []) {
      entries.push({ id: c.id, group: "Contracts & Payments", title: c.id, subtitle: formatEgp(c.valueEgp), meta: titleCase(c.status), targetRoute: "contracts" });
    }
    for (const p of payments.data ?? []) {
      entries.push({ id: p.id, group: "Contracts & Payments", title: p.reference, subtitle: formatEgp(p.amountEgp), meta: titleCase(p.status), targetRoute: "payments" });
    }
    for (const d of documents.data ?? []) {
      entries.push({ id: d.id, group: "Documents", title: d.name, subtitle: titleCase(d.docType), meta: titleCase(d.status), targetRoute: "documents" });
    }
    return entries;
  }, [units.data, projects.byId, customers.data, leads.data, contracts.data, payments.data, documents.data]);

  return function searchEverything(query: string): CommandResult[] {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    return index
      .filter((item) => `${item.title} ${item.subtitle}`.toLowerCase().includes(q))
      .slice(0, 40)
      .map((item) => ({
        id: `${item.group}:${item.id}`,
        group: item.group,
        title: item.title,
        sub: item.subtitle,
        meta: item.meta,
        icon: GROUP_ICON[item.group],
        perform: () => navigate(`/${item.targetRoute}`),
      }));
  };
}
