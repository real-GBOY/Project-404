import { useEffect, useState, type SubmitEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../components/icon";
import { brand, contact, navLinks, socials } from "../data";

/** Tracks which nav section is on screen so the matching link is highlighted, like `.nav-link.active`. */
function useActiveSection(ids: string[]) {
  const [active, setActive] = useState(ids[0]);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-35% 0px -55% 0px", threshold: [0, 0.25, 0.5, 1] },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

const SECTION_IDS = navLinks.map((l) => l.href.slice(1));

/** Jumps to the first section whose text contains the query — the page is one long document. */
function searchPage(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  const hit = [...document.querySelectorAll<HTMLElement>("main section[id], footer[id]")].find((s) =>
    s.innerText.toLowerCase().includes(q),
  );
  hit?.scrollIntoView({ behavior: "smooth", block: "start" });
  return Boolean(hit);
}

function SearchBox({ className = "", onDone }: { className?: string; onDone?: () => void }) {
  const [query, setQuery] = useState("");
  const [missed, setMissed] = useState(false);
  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    const found = searchPage(query);
    setMissed(!found && query.trim() !== "");
    if (found) onDone?.();
  };
  return (
    <form role="search" className={`relative ${className}`} onSubmit={submit}>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setMissed(false);
        }}
        placeholder="Search..."
        aria-label="Search the page"
        className={`w-full rounded-4xl border-0 bg-secondary py-2 ps-6 pe-12 text-base placeholder:text-muted [&::-webkit-search-cancel-button]:hidden ${missed ? "ring-1 ring-primary" : ""}`}
      />
      <button type="submit" aria-label="Search" className="absolute top-1/2 right-0 me-4 -translate-y-1/2 cursor-pointer p-1 hover:text-primary">
        <Icon name="search" size={20} />
      </button>
    </form>
  );
}

function TopBar() {
  return (
    <div className="bg-secondary py-1">
      <div className="px-side flex flex-wrap items-center justify-between gap-y-1">
        <ul className="flex flex-wrap text-sm">
          <li className="me-6 hidden items-center capitalize md:flex">
            <Icon name="location" size={15} className="me-1 text-accent" />
            {contact.topBarAddress}
          </li>
          <li className="me-6 flex items-center">
            <Icon name="phone" size={15} className="me-1 text-accent" />
            <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a>
          </li>
          <li className="flex items-center">
            <Icon name="email" size={15} className="me-1 text-accent" />
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </li>
        </ul>
        <SocialLinks />
      </div>
    </div>
  );
}

export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-6 ${className}`}>
      {socials.map((s) => (
        <li key={s.name}>
          <a href={s.href} aria-label={s.label} className="block text-accent hover:text-primary">
            <Icon name={s.name} size={16} />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function Header() {
  const active = useActiveSection(SECTION_IDS);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const linkClass = (href: string) =>
    `capitalize transition-colors hover:text-primary ${active === href.slice(1) ? "text-primary" : "text-body"}`;

  return (
    <header>
      <TopBar />
      <nav aria-label="Primary" className="py-6">
        <div className="px-side flex items-center justify-between">
          <a href="#home" aria-label={`${brand.fullName} home`} className="shrink-0">
            <img src="/images/main-logo.png" alt={brand.name} width={179} height={43} className="h-auto max-w-full" />
          </a>

          <ul className="hidden items-center lg:flex">
            {navLinks.map((l) => (
              <li key={l.href} className="px-4">
                <a href={l.href} className={linkClass(l.href)} aria-current={active === l.href.slice(1) ? "page" : undefined}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <SearchBox className="hidden w-56 lg:block" />

          <button
            type="button"
            className="cursor-pointer p-2 text-ink lg:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" size={60} />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[400px] flex-col bg-white lg:hidden"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <div className="flex justify-end px-6 pt-6">
                <button type="button" aria-label="Close menu" className="cursor-pointer p-1 text-ink" onClick={() => setMenuOpen(false)}>
                  <Icon name="close" size={28} />
                </button>
              </div>
              <SearchBox className="m-12 mb-6" onDone={() => setMenuOpen(false)} />
              <ul className="flex flex-col items-center">
                {navLinks.map((l) => (
                  <li key={l.href}>
                    <a href={l.href} className={`block py-[15px] text-[30px] ${linkClass(l.href)}`} onClick={() => setMenuOpen(false)}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
