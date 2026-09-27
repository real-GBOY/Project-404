import { useEffect, useState, type SubmitEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useLenis } from "lenis/react";
import type Lenis from "lenis";
import { Icon } from "../components/icon";
import { Wordmark } from "../components/ui";
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

/**
 * Glides to a section. `force` lets it run while the mobile menu has scrolling paused;
 * without Lenis (reduced motion) it falls back to a native jump.
 */
function scrollToTarget(lenis: Lenis | undefined, target: HTMLElement | string) {
  if (lenis) return lenis.scrollTo(target, { offset: -16, force: true });
  const el = typeof target === "string" ? document.querySelector<HTMLElement>(target) : target;
  el?.scrollIntoView({ block: "start" });
}

/** The first section whose text contains the query — the page is one long document. */
function findSection(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return [...document.querySelectorAll<HTMLElement>("main section[id], footer[id]")].find((s) =>
    s.innerText.toLowerCase().includes(q),
  );
}

function SearchBox({ className = "", onDone }: { className?: string; onDone?: () => void }) {
  const [query, setQuery] = useState("");
  const [missed, setMissed] = useState(false);
  const lenis = useLenis();
  const submit = (e: SubmitEvent) => {
    e.preventDefault();
    const hit = findSection(query);
    setMissed(!hit && query.trim() !== "");
    if (!hit) return;
    onDone?.();
    scrollToTarget(lenis, hit);
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
          <li className="me-6 hidden items-center capitalize xl:flex">
            <Icon name="location" size={15} className="me-1 text-accent" />
            {contact.topBarAddress}
          </li>
          <li className="me-4 flex items-center sm:me-6">
            <Icon name="phone" size={15} className="me-1 text-accent" />
            <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a>
          </li>
          <li className="hidden items-center md:flex">
            <Icon name="email" size={15} className="me-1 text-accent" />
            <a href={`mailto:${contact.email}`}>{contact.email}</a>
          </li>
        </ul>
        <SocialLinks className="hidden min-[400px]:flex" />
      </div>
    </div>
  );
}

export function SocialLinks({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-4 sm:gap-6 ${className}`}>
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
  const lenis = useLenis();

  // While the drawer is open the page behind it must not scroll.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    lenis?.stop();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      lenis?.start();
    };
  }, [menuOpen, lenis]);

  const linkClass = (href: string) =>
    `capitalize transition-colors hover:text-primary ${active === href.slice(1) ? "text-primary" : "text-body"}`;

  return (
    <header>
      <TopBar />
      <nav aria-label="Primary" className="py-4 lg:py-6">
        <div className="px-side flex items-center justify-between">
          <a href="#home" aria-label={`${brand.fullName} home`} className="shrink-0">
            <Wordmark name={brand.name} />
          </a>

          <ul className="hidden items-center lg:flex">
            {navLinks.map((l) => (
              <li key={l.href} className="px-3 xl:px-4">
                <a href={l.href} className={linkClass(l.href)} aria-current={active === l.href.slice(1) ? "page" : undefined}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>

          <SearchBox className="hidden w-44 lg:block xl:w-56" />

          <button
            type="button"
            className="cursor-pointer p-2 text-ink lg:hidden"
            aria-label="Open menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Icon name="menu" size={44} />
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
                    <a href={l.href} className={`block py-[15px] text-[30px] ${linkClass(l.href)}`} onClick={(e) => {
                        e.preventDefault();
                        setMenuOpen(false);
                        scrollToTarget(lenis, l.href);
                      }}
                    >
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
