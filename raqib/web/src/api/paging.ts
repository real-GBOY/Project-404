import { http } from "@/services/http";

/**
 * The backend pages its big lists (`{ items, nextCursor }`, max 500 a page). The screens work on the whole
 * list, so this follows the cursor until it ends; a runaway server is stopped after `MAX_PAGES` pages.
 */
const PAGE_SIZE = 200;
const MAX_PAGES = 50;
export async function allPages<T, X extends object = object>(
  path: string,
): Promise<{ items: T[] } & X> {
  const items: T[] = [];
  let cursor: string | null = null;
  let extra = {} as X;
  for (let i = 0; i < MAX_PAGES; i++) {
    const query: Record<string, string | number> = { limit: PAGE_SIZE };
    if (cursor) query.cursor = cursor;
    const r: { items: T[]; nextCursor?: string | null } & X = await http(path, { query });
    items.push(...r.items);
    const { items: _i, nextCursor, ...rest } = r;
    extra = rest as unknown as X;
    cursor = nextCursor ?? null;
    if (!cursor) break;
  }
  return { ...extra, items };
}
