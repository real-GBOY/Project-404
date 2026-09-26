import { useState, type SubmitEvent } from "react";
import { ArrowButton, Reveal } from "../components/ui";
import { Icon } from "../components/icon";
import { SocialLinks } from "./header";
import { brand, contact, footer } from "../data";

const INPUT = "w-full rounded-md border border-body bg-transparent px-6 py-4 placeholder:text-muted focus:border-ink";
// Bootstrap row: col-lg-3 / offset-lg-1 / col-lg-3 / offset-lg-1 / col-lg-3.
const GRID = "grid gap-x-6 gap-y-6 md:grid-cols-2 lg:grid-cols-12 lg:gap-y-0";
const COL = "lg:col-span-3";

function Newsletter() {
  const [done, setDone] = useState(false);
  const submit = (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    // No mailing-list backend yet — acknowledge locally.
    setDone(true);
    e.currentTarget.reset();
  };
  return (
    <div className={`${COL} lg:col-start-5`}>
      <h4 className="display-6">{footer.newsletter.title}</h4>
      <p>{footer.newsletter.body}</p>
      <form onSubmit={submit} onChange={() => setDone(false)}>
        <input type="text" name="name" required autoComplete="name" placeholder="Your Name" aria-label="Your name" className={`${INPUT} mb-4`} />
        <input type="email" name="email" required autoComplete="email" placeholder="Your Email" aria-label="Your email" className={INPUT} />
        <div className="grid">
          <ArrowButton type="submit" className="mt-4">
            {footer.newsletter.submit}
          </ArrowButton>
        </div>
        <p role="status" className="mt-3 mb-0 min-h-6 text-sm text-primary">
          {done ? footer.newsletter.success : ""}
        </p>
      </form>
    </div>
  );
}

export function Footer() {
  const [nameLine, ...addressLines] = contact.addressLines;
  return (
    <footer id="contact">
      <Reveal className="px-side pb-20">
        <div className={GRID}>
          <div className={COL}>
            <img src="/images/main-logo-footer.png" alt={brand.name} width={180} height={43} className="h-auto max-w-full" />
            <p className="mt-4">{footer.about}</p>
            <SocialLinks className="mt-6" />
          </div>

          <Newsletter />

          <address className={`${COL} not-italic lg:col-start-9`}>
            <h4 className="display-6">{footer.infoTitle}</h4>
            <ul>
              <li className="flex items-center capitalize">
                <Icon name="location" size={20} className="me-1 text-accent" />
                {nameLine}
              </li>
              {addressLines.map((line) => (
                <li key={line} className="ms-6">
                  {line}
                </li>
              ))}
              <li className="mt-2 flex items-center">
                <Icon name="phone" size={20} className="me-1 shrink-0 text-accent" />
                <span>
                  <a href={`tel:${contact.phone.replace(/[^+\d]/g, "")}`}>{contact.phone}</a>,{" "}
                  <a href={`tel:${contact.phoneAlt.replace(/[^+\d]/g, "")}`}>{contact.phoneAlt}</a>
                </span>
              </li>
              <li className="mt-2 flex items-center">
                <Icon name="email" size={20} className="me-1 text-accent" />
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </li>
            </ul>
          </address>
        </div>
      </Reveal>

      <hr className="border-ink/25" />

      <Reveal className="px-side py-20">
        <div className={GRID}>
          {footer.columns.map((col, i) => (
            <nav key={col.title} aria-label={col.title} className={`${COL} ${i === 1 ? "lg:col-start-5" : ""}`}>
              <h4 className="display-6">{col.title}</h4>
              <ul className="flex flex-col">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href}>{l.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <div className={`${COL} lg:col-start-9`}>
            <p className="mb-0">{footer.copyright}</p>
            <p>
              Design:{" "}
              <a href={footer.credit.href} target="_blank" rel="noreferrer" className="underline">
                {footer.credit.label}
              </a>
            </p>
          </div>
        </div>
      </Reveal>
    </footer>
  );
}
