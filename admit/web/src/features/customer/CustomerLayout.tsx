import { Link, NavLink, Outlet, useParams } from "react-router-dom";
import { Logo } from "@/components/Logo";
import { useCatalogue } from "./hooks";

export function CustomerLayout() {
  const { org = "" } = useParams();
  const cat = useCatalogue();
  const name = cat.data?.organizer.name;
  const nav = "text-[15px] font-medium no-underline hover:text-brand-deep";
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink bg-paper">
        <div className="mx-auto flex h-[68px] w-full max-w-[1280px] items-center gap-5 px-4 md:gap-7 md:px-6">
          <Link to={`/e/${org}`} className="no-underline" aria-label="Admit home">
            <Logo />
          </Link>
          <nav className="flex flex-1 gap-5" aria-label="Main">
            <NavLink to={`/e/${org}/events`} className={nav}>
              All events
            </NavLink>
            {name ? <span className="hidden text-sm text-muted md:inline">by {name}</span> : null}
          </nav>
          <Link
            to={`/e/${org}/find`}
            className="inline-flex h-10 items-center whitespace-nowrap rounded-sm border border-ink px-4 text-sm font-semibold no-underline hover:bg-ink hover:text-paper"
          >
            My booking
          </Link>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer name={name} support={cat.data?.organizer.supportEmail ?? null} org={org} />
    </div>
  );
}

function Footer({ name, support, org }: { name?: string; support: string | null; org: string }) {
  return (
    <footer className="mt-20 bg-night text-rule-strong">
      <div className="mx-auto grid w-full max-w-[1280px] gap-7 px-4 py-10 text-sm leading-8 md:grid-cols-4 md:px-6">
        <div className="flex flex-col gap-2">
          <Logo size={22} light />
          <span className="leading-normal text-faint">
            Tickets for events in Egypt, paid directly to organizers and verified by people.
          </span>
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-paper">Tickets</span>
          <Link to={`/e/${org}/find`} className="text-rule-strong">
            Find my booking
          </Link>
          <Link to={`/e/${org}/events`} className="text-rule-strong">
            All events
          </Link>
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-paper">Organizers</span>
          <Link to="/admin" className="text-rule-strong">
            Organizer sign in
          </Link>
        </div>
        <div className="flex flex-col">
          <span className="font-semibold text-paper">{name ?? "Support"}</span>
          {support ? (
            <a href={`mailto:${support}`} className="text-rule-strong">
              {support}
            </a>
          ) : (
            <span className="text-faint">Contact the organizer</span>
          )}
        </div>
      </div>
    </footer>
  );
}
