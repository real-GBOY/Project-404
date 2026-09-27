import { useState } from "react";
import { Link } from "react-router-dom";
import { useGuests } from "@/api/guests";
import { useAuth } from "@/features/auth/use-auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { GuestDialog } from "./guest-dialog";
import { VipBadge } from "./vip-badge";

const PAGE_SIZE = 24;

/** Guests (design: "Guests"): search by name, phone or email; cards open the Guest 360 profile. */
export function GuestsPage() {
  const auth = useAuth();
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const q = useDebouncedValue(query.trim());
  const guests = useGuests({ q, page, pageSize: PAGE_SIZE });
  const total = guests.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Guests"
        actions={
          auth.can("create:guest") ? (
            <Button onClick={() => setCreating(true)}>+ New guest</Button>
          ) : null
        }
      />
      <input
        type="search"
        aria-label="Search guests"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setPage(1);
        }}
        placeholder="Search by name, phone or email…"
        className="mb-[18px] w-full max-w-[420px] rounded-button border border-border bg-surface px-3.5 py-2.5 text-body outline-none placeholder:text-faint focus:border-primary"
      />

      {guests.isLoading ? (
        <LoadingState />
      ) : guests.error ? (
        <ErrorState error={guests.error} />
      ) : guests.data!.items.length === 0 ? (
        <EmptyState title={q ? `No guests match “${q}”` : "No guests yet"} />
      ) : (
        <>
          <ul className="m-0 grid list-none grid-cols-1 gap-3.5 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {guests.data!.items.map((g) => (
              <li key={g.id}>
                <Link
                  to={`/guests/${g.id}`}
                  className="block rounded-card border border-border bg-surface p-[18px] hover:border-primary"
                >
                  <div className="flex items-center gap-3">
                    <Avatar name={g.fullName} />
                    <div className="min-w-0">
                      <div className="truncate text-body font-bold">{g.fullName}</div>
                      <div className="truncate text-label text-faint">{g.phone ?? g.email}</div>
                    </div>
                    {g.vip ? <VipBadge className="ml-auto" /> : null}
                  </div>
                  <div className="mt-3 flex justify-between gap-2 text-label text-muted">
                    <span className="truncate">{g.email ?? "No email"}</span>
                    <span>{g.nationality ?? ""}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <nav
              aria-label="Guest pages"
              className="mt-5 flex items-center justify-center gap-3 text-small"
            >
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-muted">
                Page {page} of {pages} · {total} guests
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </nav>
          ) : null}
        </>
      )}

      {creating ? <GuestDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}
