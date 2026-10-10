import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { QueryState, Skeleton } from "@/components/QueryState";
import { Button } from "@/components/Button";
import { EventCard, Page } from "./parts";
import { filterEvents, type Sort } from "./filter-events";
import { useCatalogue, useOrg } from "./hooks";

export function EventsPage() {
  const org = useOrg();
  const q = useCatalogue();
  const [params, setParams] = useSearchParams();
  const text = params.get("q") ?? "";
  const category = params.get("category") ?? "";
  const sort = (params.get("sort") as Sort) || "soonest";
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };

  const shown = useMemo(
    () => filterEvents(q.data?.events ?? [], { q: text, category, sort }),
    [q.data, text, category, sort],
  );

  return (
    <Page className="flex flex-col gap-5">
      <div className="border-b-2 border-ink pb-3.5">
        <h1 className="display text-5xl md:text-6xl">All events</h1>
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          aria-label="Search events, artists, venues"
          value={text}
          onChange={(e) => set("q", e.target.value)}
          placeholder="Search events, artists, venues"
          className="h-11 min-w-[240px] flex-1 rounded-sm border border-ink bg-surface px-3.5 text-base"
        />
        <select
          aria-label="Sort"
          value={sort}
          onChange={(e) => set("sort", e.target.value === "soonest" ? "" : e.target.value)}
          className="h-11 rounded-sm border border-rule-strong bg-surface px-2.5 text-sm"
        >
          <option value="soonest">Sort: Soonest</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
        <button
          aria-pressed={!category}
          onClick={() => set("category", "")}
          className={`h-[34px] rounded-full px-3.5 text-sm font-medium ${!category ? "bg-ink text-paper" : "border border-rule-strong bg-surface"}`}
        >
          All
        </button>
        {q.data?.categories.map((c) => (
          <button
            key={c.name}
            aria-pressed={category === c.name}
            onClick={() => set("category", c.name)}
            className={`h-[34px] rounded-full px-3.5 text-sm ${category === c.name ? "bg-ink text-paper" : "border border-rule-strong bg-surface"}`}
          >
            {c.name} <span className="ml-1 font-mono text-[11px] opacity-70">{c.count}</span>
          </button>
        ))}
      </div>

      <QueryState
        query={q}
        skeleton={
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
            {[1, 2, 3, 4].map((k) => (
              <Skeleton key={k} className="h-72" />
            ))}
          </div>
        }
      >
        {() =>
          shown.length === 0 ? (
            <div className="flex flex-col items-center gap-3 border border-rule-strong bg-surface px-6 py-14 text-center">
              <span className="display text-4xl">No events match</span>
              <p className="max-w-md text-[15px] leading-normal text-ink-2">
                {text ? `Nothing for “${text}”` : "Nothing here"}
                {category ? ` in ${category}` : ""}. Try a wider search or another category.
              </p>
              <Button variant="ink" size="md" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </Button>
            </div>
          ) : (
            <>
              <span role="status" className="text-sm text-ink-2">
                {shown.length} event{shown.length === 1 ? "" : "s"} · soonest first
              </span>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {shown.map((e) => (
                  <EventCard key={e.id} org={org} e={e} />
                ))}
              </div>
            </>
          )
        }
      </QueryState>
    </Page>
  );
}
