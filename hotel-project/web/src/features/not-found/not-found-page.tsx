import { useEffect } from "react";
import { motion } from "motion/react";
import { ArrowLink, Wordmark } from "@/features/landing/components/ui";
import { Icon } from "@/features/landing/components/icon";
import { brand, contact } from "@/features/landing/data";

// Hotel "directory" of the places a lost guest most likely wanted.
const DIRECTORY = [
  { label: "Rooms & Suites", href: "/#rooms" },
  { label: "Services & Facilities", href: "/#services" },
  { label: "Gallery", href: "/#gallery" },
  { label: "Contact Us", href: "/#contact" },
];

/** A hotel key tag reading "Room 404", swinging gently from its ring (held still for reduced-motion users). */
function KeyTag() {
  return (
    <div className="relative mx-auto w-36 sm:w-48 lg:w-[280px]" aria-hidden="true">
      <motion.svg
        viewBox="0 0 240 400"
        className="w-full overflow-visible"
        style={{ transformOrigin: "120px 36px" }}
        animate={{ rotate: [-5, 5] }}
        transition={{ duration: 3.2, ease: "easeInOut", repeat: Infinity, repeatType: "mirror" }}
      >
        <defs>
          <linearGradient id="tag-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#e2842a" />
            <stop offset="1" stopColor="var(--color-primary)" />
          </linearGradient>
        </defs>
        {/* hook + brass ring */}
        <rect x="112" y="0" width="16" height="22" rx="4" fill="var(--color-body)" />
        <circle cx="120" cy="44" r="22" fill="none" stroke="var(--color-accent)" strokeWidth="7" />
        {/* tag body */}
        <path
          d="M120 58c40 0 76 12 76 44v196c0 50-34 82-76 82s-76-32-76-82V102c0-32 36-44 76-44z"
          fill="url(#tag-fill)"
        />
        <path
          d="M120 72c34 0 62 10 62 34v190c0 42-28 70-62 70s-62-28-62-70V106c0-24 28-34 62-34z"
          fill="none"
          stroke="var(--color-secondary)"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeDasharray="4 5"
        />
        <circle cx="120" cy="92" r="9" fill="var(--color-secondary)" />
        <text x="120" y="150" textAnchor="middle" fill="var(--color-secondary)" fontFamily="var(--font-sans)" fontSize="12" letterSpacing="3.5">
          HOTEL {brand.name.toUpperCase()}
        </text>
        <text x="120" y="200" textAnchor="middle" fill="var(--color-secondary)" fontFamily="var(--font-sans)" fontSize="15" letterSpacing="6" opacity="0.85">
          ROOM
        </text>
        <text x="120" y="290" textAnchor="middle" fill="var(--color-secondary)" fontFamily="var(--font-heading)" fontSize="92" fontWeight="600">
          404
        </text>
      </motion.svg>
      {/* soft shadow on the "floor" */}
      <div className="mx-auto mt-6 h-3 w-2/3 rounded-full bg-ink/10 blur-md" />
    </div>
  );
}

export function NotFoundPage() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `Page not found — ${brand.fullName}`;
    // Keep missing URLs out of search results.
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.appendChild(robots);
    return () => {
      document.title = prevTitle;
      robots.remove();
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <header className="px-side flex items-center justify-between py-4 lg:py-6">
        <a href="/" aria-label={`${brand.fullName} home`}>
          <Wordmark name={brand.name} />
        </a>
        <a href="/" className="group inline-flex items-center gap-2 text-body hover:text-primary">
          <Icon name="arrowLeft" size={18} className="transition-transform duration-300 group-hover:-translate-x-1" />
          Back to home
        </a>
      </header>

      <main className="px-side flex flex-1 pb-6">
        <section
          aria-labelledby="nf-title"
          className="grid w-full items-center gap-12 rounded-2xl bg-secondary px-6 py-14 sm:rounded-4xl sm:px-12 md:py-16 lg:grid-cols-[1.15fr_1fr] lg:gap-8 lg:px-16"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
            className="order-2 text-center lg:order-1 lg:text-left"
          >
            <p className="mb-3 text-sm tracking-[0.2em] text-primary uppercase">Error 404 · Page not found</p>
            <h1 id="nf-title" className="display-3 mb-5">
              This Room Isn&apos;t On Any Floor
            </h1>
            <p className="mx-auto max-w-lg lg:mx-0">
              We looked in every corridor of {brand.fullName}, but the page you asked for has checked out — or
              never checked in. Let us walk you back to the lobby.
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <ArrowLink href="/" className="bg-white!">
                Back to the Lobby
              </ArrowLink>
              <ArrowLink href="/#rooms" variant="link">
                Explore Our Rooms
              </ArrowLink>
            </div>

            <nav aria-label="Hotel directory" className="mt-12 border-t border-hairline pt-8">
              <p className="mb-4 text-sm tracking-[0.2em] text-muted uppercase">Hotel directory</p>
              <ul className="grid grid-cols-2 gap-3 text-left sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
                {DIRECTORY.map((d) => (
                  <li key={d.href}>
                    <a
                      href={d.href}
                      className="group flex h-full items-center justify-between gap-2 rounded-btn border border-hairline bg-white px-4 py-3 text-body transition-colors hover:border-primary hover:text-primary"
                    >
                      {d.label}
                      <Icon name="arrowRight" size={16} className="shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <p className="mt-8 mb-0 text-sm text-muted">
              Need a hand? Our front desk is open 24/7 —{" "}
              <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`} className="whitespace-nowrap text-body underline underline-offset-4">
                {contact.phone}
              </a>
            </p>
          </motion.div>

          <div className="order-1 lg:order-2">
            <KeyTag />
          </div>
        </section>
      </main>
    </div>
  );
}
