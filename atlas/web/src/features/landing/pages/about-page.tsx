import { InfoPageLayout } from "../info-page-layout";

export function AboutPage() {
  return (
    <InfoPageLayout eyebrow="About" title="What Atlas actually is">
      <p>
        Atlas RE OS is a real-estate business platform — CRM, inventory, sales, payment plans, finance, operations and an
        AI Copilot, all reading and writing the same underlying data. It is the second product built on{" "}
        <a href="https://github.com/real-GBOY/Project-404" target="_blank" rel="noreferrer">
          AURIC Core
        </a>
        , a shared foundation (identity, RBAC, multi-tenancy, audit, an AI-orchestration engine) that Atlas and its sibling
        product, Mizan, both run on independently.
      </p>
      <p>
        Atlas exists to answer a specific question: after building one real product on AURIC Core, which parts of that
        foundation were genuinely reusable, and which were quietly shaped by the first product's domain? Building a second,
        structurally independent product — its own package, its own database, a completely different business (real estate,
        not law) — was the only honest way to find out.
      </p>
      <p>
        Everything you can reach from this site is real: a live NestJS/Fastify backend, a Postgres database with row-level
        tenant isolation, a real Groq-backed AI Copilot, and demo data seeded for a fictional Egyptian developer's
        portfolio. Sign in with the demo credentials pre-filled on the login screen to look around.
      </p>
    </InfoPageLayout>
  );
}
