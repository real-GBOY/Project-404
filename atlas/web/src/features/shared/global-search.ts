import type { CommandResult } from "@/components/navigation/command-palette";
import { SEARCH_INDEX } from "@/mocks/fixtures/search-index";

const GROUP_ICON: Record<string, string> = {
  Units: "unit",
  Customers: "customer",
  Leads: "lead",
  Projects: "project",
  "Contracts & Payments": "payment",
  Documents: "doc",
};

/** ⌘K omnisearch across units, customers, leads, projects, contracts & payments, and documents. */
export function createGlobalSearch(navigate: (to: string) => void) {
  return function searchEverything(query: string): CommandResult[] {
    const q = query.toLowerCase();
    const results: CommandResult[] = [];
    for (const group of SEARCH_INDEX) {
      for (const item of group.items) {
        const haystack = `${item.title} ${item.subtitle}`.toLowerCase();
        if (!haystack.includes(q)) continue;
        results.push({
          id: `${group.group}:${item.title}`,
          group: group.group,
          title: item.title,
          sub: item.subtitle,
          meta: item.meta,
          icon: GROUP_ICON[group.group],
          perform: () => navigate(`/${item.targetRoute}`),
        });
      }
    }
    return results;
  };
}
