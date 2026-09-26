import { useState, type SubmitEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowButton, Reveal, Wordmark } from "../components/ui";
import { Icon } from "../components/icon";
import { brand, contact, footer, socials } from "../data";

const tel = (n: string) => `tel:${n.replace(/[^+\d]/g, "")}`;

// Same vocabulary as the rest of the page: Cormorant titles, uppercase Sora labels (like the booking form).
const COL_TITLE = "mb-5 text-[1.75rem] leading-tight";
const LABEL = "mb-3 text-sm tracking-[0.2em] text-primary uppercase";

/** Body-coloured link that turns primary and grows a thin primary underline on hover. */
function FooterLink({ href, children, className = "" }: { href: string; children: string; className?: string }) {
  return (
    <a
      href={href}
      className={`relative text-body transition-colors after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-primary after:transition-transform after:duration-300 hover:text-primary hover:after:scale-x-100 ${className}`}
    >
      {children}
    </a>
  );
}

function Newsletter() {
  const [done, setDone] = useState(false);
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    // No mailing-list backend yet — acknowledge locally.
    setDone(true);
    e.currentTarget.reset();
  };
  const n = footer.newsletter;
  return (
    <div className="grid items-center gap-8 rounded-2xl border border-hairline bg-white p-6 sm:p-10 lg:grid-cols-2 lg:gap-16 lg:p-12">
      <div>
        <p className={LABEL}>{n.eyebrow}</p>
        <h2 className="display-5 mb-0">{n.title}</h2>
      </div>
      <div>
        <p>{n.body}</p>
        <form onSubmit={submit} onChange={() => setDone(false)} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            placeholder={n.placeholder}
            aria-label={n.placeholder}
            className="min-w-0 flex-1 rounded-btn border border-field bg-transparent px-5 py-4 transition-colors placeholder:text-muted focus:border-body"
          />
          <ArrowButton type="submit">{n.submit}</ArrowButton>
        </form>
        <div className="min-h-7 pt-3" role="status">
          <AnimatePresence>
            {done && (
              <motion.p className="mb-0 text-sm text-primary" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {n.success}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  const [nameLine, ...addressLines] = contact.addressLines;
  return (
    <footer id="contact" className="px-side pb-6">
      <Reveal>
        <div className="overflow-hidden rounded-4xl bg-secondary">

          <div className="px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8">
            <Newsletter />
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-12 px-6 py-14 sm:px-12 lg:grid-cols-12 lg:gap-8 lg:px-16 lg:py-20">
            <div className="col-span-2 lg:col-span-4">
              <a href="#home" aria-label={`${brand.fullName} — back to top`} className="inline-block">
                <Wordmark name={brand.name} />
              </a>
              <p className="mt-6 mb-8 max-w-sm">{footer.about}</p>
              <ul className="flex flex-wrap gap-3">
                {socials.map((s) => (
                  <li key={s.name}>
                    <a
                      href={s.href}
                      aria-label={s.label}
                      className="grid size-10 place-items-center rounded-full border border-hairline bg-white text-accent transition-all duration-300 hover:-translate-y-0.5 hover:border-primary hover:text-primary"
                    >
                      <Icon name={s.name} size={16} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {footer.columns.map((col) => (
              <nav key={col.title} aria-label={col.title} className="lg:col-span-2">
                <h4 className={COL_TITLE}>{col.title}</h4>
                <ul className="space-y-3">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <FooterLink href={l.href}>
                        {l.label}
                      </FooterLink>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}

            <address className="col-span-2 not-italic lg:col-span-4">
              <h4 className={COL_TITLE}>{footer.infoTitle}</h4>
              <div className="flex gap-3">
                <Icon name="location" size={20} className="mt-0.5 shrink-0 text-accent" />
                <p className="mb-0">
                  <span className="text-ink">{nameLine}</span>
                  {addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </p>
              </div>
              <ul className="mt-5 space-y-3">
                <li className="flex items-center gap-3">
                  <Icon name="phone" size={20} className="shrink-0 text-accent" />
                  <span className="flex flex-wrap items-center gap-x-2">
                    <FooterLink href={tel(contact.phone)} className="whitespace-nowrap">{contact.phone}</FooterLink>
                    <span className="text-muted/50">/</span>
                    <FooterLink href={tel(contact.phoneAlt)} className="whitespace-nowrap">{contact.phoneAlt}</FooterLink>
                  </span>
                </li>
                <li className="flex items-center gap-3">
                  <Icon name="email" size={20} className="shrink-0 text-accent" />
                  <FooterLink href={`mailto:${contact.email}`} className="min-w-0 break-all">{contact.email}</FooterLink>
                </li>
                <li className="flex items-center gap-3 text-sm text-muted">
                  <Icon name="clock" size={20} className="shrink-0 text-accent" />
                  {footer.hours}
                </li>
              </ul>
            </address>
          </div>

          <div className="flex flex-col-reverse items-center gap-5 border-t border-hairline px-6 py-7 text-sm text-muted sm:px-12 md:flex-row md:justify-between lg:px-16">
            <p className="mb-0 text-center md:text-left">
              {footer.copyright}
              <span className="mx-2 text-hairline">·</span>
              Powered by <span className="font-medium tracking-[0.12em] text-body">{footer.poweredBy}</span>
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              {footer.legal.map((l) => (
                <FooterLink key={l.label} href={l.href} className="whitespace-nowrap">
                  {l.label}
                </FooterLink>
              ))}
              {/* Same round arrow button as the gallery controls. */}
              <a
                href="#home"
                aria-label="Back to top"
                className="grid size-12 place-items-center rounded-full bg-white text-body transition-all duration-300 hover:-translate-y-1 hover:text-primary"
              >
                <Icon name="arrowRight" size={20} className="-rotate-90" />
              </a>
            </div>
          </div>
        </div>
      </Reveal>
    </footer>
  );
}
