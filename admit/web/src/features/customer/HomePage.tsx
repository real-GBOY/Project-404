import { Link, useNavigate } from "react-router-dom";
import { QueryState, Skeleton } from "@/components/QueryState";
import { fmtWhen, moneyShort } from "@/lib/format";
import { availabilityText } from "./availability";
import { Cover, DateBlock, EventCard, Page, SectionHead } from "./parts";
import { useCatalogue, useOrg } from "./hooks";
import { FindBookingForm } from "./FindBookingPage";

export function HomePage() {
  const org = useOrg();
  const q = useCatalogue();
  const nav = useNavigate();
  return (
    <Page className="flex flex-col gap-14">
      <QueryState
        query={q}
        skeleton={<Skeleton className="h-96 w-full" />}
        empty={(d) =>
          d.events.length === 0 ? (
            <div className="border border-rule-strong bg-surface p-14 text-center">
              <p className="display-l text-4xl">No events on sale yet</p>
              <p className="mt-3 text-ink-2">
                Check back soon, or look up a booking you already made below.
              </p>
            </div>
          ) : (
            false
          )
        }
      >
        {(d) => {
          const featured = d.events[0]!;
          const a = availabilityText(featured.availability);
          return (
            <>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Categories">
                {d.categories.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => nav(`/e/${org}/events?category=${encodeURIComponent(c.name)}`)}
                    className="h-9 rounded-full border border-rule-strong bg-surface px-3.5 text-sm font-medium hover:border-ink"
                  >
                    {c.name}{" "}
                    <span className="ml-1 font-mono text-[11px] text-muted">{c.count}</span>
                  </button>
                ))}
              </div>

              <section
                className={`grid grid-cols-1 border border-ink bg-night text-paper ${featured.coverUrl ? "md:grid-cols-2" : ""}`}
              >
                {featured.coverUrl ? (
                  <Cover
                    url={featured.coverUrl}
                    night
                    label="featured event photo"
                    ratio="16/10"
                    className="min-h-[220px] md:h-full md:min-h-[300px]"
                  />
                ) : null}
                <div className="flex min-w-0 flex-col justify-between gap-5 p-5 sm:p-8 md:p-9">
                  <div className="flex flex-col gap-4">
                    <span className="label tracking-[0.12em] text-brand-soft">
                      Featured{featured.category ? ` · ${featured.category}` : ""}
                    </span>
                    <h1 className="display break-words text-4xl sm:text-5xl md:text-7xl">
                      {featured.title}
                    </h1>
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t border-ink-2 pt-4 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] uppercase tracking-widest text-faint">When</span>
                      <span className="font-mono">{fmtWhen(featured.startsAt)}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[11px] uppercase tracking-widest text-faint">
                        Where
                      </span>
                      <span>
                        {featured.venue.name}
                        {featured.venue.area ? `, ${featured.venue.area}` : ""}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Link
                      to={`/e/${org}/events/${featured.slug}`}
                      className="inline-flex h-12 items-center rounded-sm bg-brand px-5 text-[15px] font-semibold text-white no-underline hover:bg-brand-deep hover:text-white"
                    >
                      Get tickets
                      {featured.minPriceMinor != null
                        ? ` — from ${moneyShort(featured.minPriceMinor, featured.currency)}`
                        : ""}
                    </Link>
                    <span
                      className={`text-[13px] ${a.cls === "text-ink-2" ? "text-[#b5aea3]" : ""}`}
                    >
                      {a.text}
                    </span>
                  </div>
                </div>
              </section>

              <section className="flex flex-col gap-4">
                <SectionHead
                  title="Coming up"
                  action={
                    <Link to={`/e/${org}/events`} className="text-sm font-semibold">
                      All events →
                    </Link>
                  }
                />
                <ul className="m-0 list-none p-0">
                  {d.events.slice(0, 6).map((e) => {
                    const av = availabilityText(e.availability);
                    return (
                      <li key={e.id}>
                        <Link
                          to={`/e/${org}/events/${e.slug}`}
                          className="grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-5 border-b border-rule py-3.5 no-underline hover:bg-sunken hover:text-ink"
                        >
                          <DateBlock iso={e.startsAt} />
                          <span className="flex min-w-0 flex-col gap-1">
                            <span className="display-l text-[22px]">{e.title}</span>
                            <span className="text-sm text-ink-2">
                              {[e.category, e.venue.name, e.venue.area].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="flex flex-col items-end gap-1 whitespace-nowrap">
                            <span className="font-mono text-sm font-semibold">
                              {e.minPriceMinor != null
                                ? moneyShort(e.minPriceMinor, e.currency)
                                : "—"}
                            </span>
                            <span className={`text-xs ${av.cls}`}>{av.text}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>

              {d.events.length > 1 ? (
                <section className="flex flex-col gap-4">
                  <SectionHead title={`More from ${d.organizer.name}`} />
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {d.events.slice(1, 5).map((e) => (
                      <EventCard key={e.id} org={org} e={e} />
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          );
        }}
      </QueryState>

      <section className="grid gap-6 border-t-2 border-ink pt-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="display-l text-3xl">Already booked?</h2>
          <p className="max-w-[420px] text-[15px] leading-normal text-ink-2">
            Check payment status or open your tickets with the reference from your email. No account
            needed.
          </p>
        </div>
        <FindBookingForm />
      </section>
    </Page>
  );
}
