# AURIC Core — the complete picture

> One document: what Core is, everything it contains, how **Mizan** and **Atlas** consume it today,
> and how every **upcoming project** will consume it. It summarises and links; the per-module
> `core/<module>/README.md` files and the docs listed in §14 stay the detailed contracts.
>
> Snapshot: 2026-09-20, `main` @ `e4bc310`. Where this file and a module README disagree, the
> module README wins for that module. (Known stale spot: `core/README.md` §4–§7 does not yet list
> `assistant` and `messaging` in its responsibilities — this file does.)

---

## 1. One-paragraph summary

**AURIC Core** is a NestJS (Fastify) modular-monolith *library* of domain-agnostic platform
capabilities: identity, RBAC, organizations/tenancy, files, audit, notifications, events + outbox,
messaging, AI-assistant infrastructure, localization and observability. It knows nothing about law
firms or real estate. Every product (Mizan, Atlas, and the next ones) is a **separate deployment**
that imports Core's modules into its own Nest root module, adds its own domain module, and talks to
Core only through **DI tokens and interfaces**.

```
                       ┌──────────────── AURIC CORE (core/) ────────────────┐
                       │ kernel · identity · rbac · organizations · files   │
                       │ audit · notifications · events/outbox · messaging  │
                       │ assistant · localization · observability · http    │
                       └───────────▲───────────────────────▲────────────────┘
              imports Core modules │                       │ imports Core modules
                                   │                       │
                 ┌─────────────────┴──────┐     ┌──────────┴──────────────┐      ┌───────────────┐
                 │ MIZAN backend          │     │ ATLAS backend           │      │ Project #3…   │
                 │ mizan/backend/app      │     │ atlas/backend/app       │      │ (upcoming)    │
                 │  └ lawfirm/*           │     │  └ realestate/*         │      │               │
                 └───────────▲────────────┘     └───────────▲─────────────┘      └───────────────┘
                             │ HTTP /api (+ Socket.IO)      │
                 ┌───────────┴──────────┐        ┌──────────┴───────────┐
                 │ mizan/web · /mobile  │        │ atlas/web            │      both webs share @auric/web
                 └──────────────────────┘        └──────────────────────┘
```

Dependency direction is one-way: **Core ◀ product backend ◀ product clients**. Never `Core → mizan/`
or `Core → atlas/`, never `Core → web`. (`grep -rn "mizan/" core/` is empty.)

---

## 2. Design rules that shape everything

| # | Rule | Consequence |
|---|---|---|
| 1 | Core stays domain-agnostic. A symbol naming a business concept (Matter, Lead, Invoice…) is in the wrong place. | Products own their permissions, roles, tables, prompts. |
| 2 | **Rule of Three** (Plan §8/§10.2): nothing is extracted from a product into Core until proven by real repeated use with a stable shape. "Might be reusable" is not a reason. | Core grows by *extraction*, not by anticipation. See §11. |
| 3 | Domain code depends on **interfaces + DI tokens**, not Core classes or tables. | Product modules stay forkable; Core internals can be rewritten. |
| 4 | Every use case owns its transaction: `authn → validate → transaction → persist → publish event`. | The event bus never opens a transaction. |
| 5 | Backend authorization is the security boundary; frontend `can()` is UX only. | |
| 6 | Tenant isolation = `organization_id NOT NULL` + PostgreSQL **RLS**, not hand-written `WHERE`s. | A forgotten filter cannot leak across tenants. |
| 7 | DB constraints stay authoritative (`NOT NULL/UNIQUE/CHECK/FK`, RLS, triggers). | |
| 8 | **Prisma owns schema + migrations; Kysely runs every query.** No Prisma Client at runtime. | Types flow Prisma → `prisma-kysely` → `core/kernel/db/schema.ts`. |
| 9 | No vendor lock-in in Core: S3/R2, SMTP, LLM, Redis sit behind adapters, added only when a real requirement appears. | |
| 10 | Modular monolith, not microservices. Thin controllers; logic in domain/application layers. | |

---

## 3. What Core contains

Every module has the same anatomy: `domain/ application/ infrastructure/ api/ events/ permissions/
validation/ tests/ <name>.module.ts`. Each ships its own README.

| Module | What it gives a product | Tables it owns | HTTP / other surface |
|---|---|---|---|
| **kernel** | `AURIC_*` config parsing (fails fast at boot), pg pools (app + system role) + Kysely, **unit-of-work**, prefixed-ID factory, clock, structured logging + request context, error types, ambient **tenant context**, all DI tokens. `@Global` `KernelModule`. | — | — |
| **contracts** | The provider interfaces domain code depends on: `IUserProvider`, `IOrganizationProvider`, `ITenantContext`, `IPermissionProvider`, `INotificationProvider`, `IFileStorage`, `IAuditLogger`, `IEventBus`, `DomainEvent`/`defineEvent`. Dependency-free. | — | — |
| **identity** | Register, login, refresh-token **rotation with reuse detection**, logout/logout-all, email verification, password reset, Argon2id (auto-rehash), JWT access tokens. `UserDirectory` (`userId → display name`). | `users`, `refresh_tokens`, `verification_tokens` | `auth/*`, `me` |
| **rbac** | `User → Role → Permission`, `can(user, action, resource)` with `*` wildcards, evaluated **inside the active tenant**. Permission keys are `action:resource` (e.g. `create:matter`). Generic seeding mechanism `seedRbacDefinitions`. | `roles`, `permissions`, `role_permissions`, `user_roles` (org-scoped) | `rbac/*` |
| **organizations** | The organization **is** the tenant. Orgs, membership + membership role, org `settings` jsonb, slug uniqueness. Any authenticated user may create an org (self-service SaaS) and becomes owner + admin. | `organizations`, `organization_members` | `organizations/*` |
| **files** | Presigned upload flow: **presign → direct PUT → confirm (HEAD-verifies) → `stored`**. Local-disk + **Cloudflare R2** adapters (hand-rolled SigV4, no AWS SDK) behind `IFileStorage`; storage keys namespaced `org_x/file_y`. Legacy multipart `POST /files` kept for small server-side uploads. | `files` | `files/*` |
| **audit** | Append-only trail written **in the same transaction** as the change; immutability enforced by a DB trigger. Records shape, never message bodies. | `audit_logs` | `GET /audit-logs` |
| **notifications** | Templated, bilingual (AR/EN) **in-app + email**; email goes through the outbox (retries, never blocks a use case). Account-level notifications carry `organization_id NULL`. | `notifications`, `notification_templates` | `notifications/*` |
| **events** | In-process `EventBus` (DB-only reactions) + **transactional outbox** + polling `OutboxWorker` + dead-letter queue (external side effects, exactly-once). `registry.onInProcess` vs `registry.onExternal`. | `outbox_messages`, `dead_letter_messages` | — |
| **messaging** | Generic real-time conversations over **Socket.IO** + REST history: members, messages (reply/edit/delete/reactions/attachment refs), read cursors, typing, presence. Membership-checked; idempotent send; ordered + resyncable (`seq`/`changeSeq`). Products attach meaning via `subjectType/subjectId/metadata`. | `messaging_*` | `conversations/*`, `/socket.io` |
| **assistant** | The generic **AI Copilot engine**: `AiClient` (+ `OpenAiCompatibleClient`, Groq/OpenAI), `AssistantTool` + `ToolRegistry` (RBAC-checked in-tenant, never throws), `ScopeGuard` (heuristic → classifier → fail-open), `ConversationRepository`, `AssistantService` agent loop, response guard (credential scrubbing), `StructuredAi` (prompt → JSON → validate → repair-retry). **No controller, no prompts, no tools, no permission strings.** | `ai_conversations`, `ai_messages` | none — each product exposes its own |
| **localization** | Arabic-first: `SUPPORTED_LOCALES`, `DEFAULT_LOCALE="ar"`, RTL resolution, `ar-EG`/`en-EG` formatters in `Africa/Cairo`, AR/EN `Translatable` shape. | — | — |
| **observability** | `GET /health` (liveness), `GET /health/ready` (DB + **outbox-worker health**, so silent event pile-up is a visible 503), `ERROR_TRACKER` hook for Sentry/Datadog later. | — | `health`, `health/ready` |
| **http** | `SecurityModule`: `JwtAuthGuard`, `PermissionGuard` (`@RequirePermission`), Zod validation pipe, `AppExceptionFilter` (one error envelope `{ error: { code, message, details } }`), request-context middleware (correlation id + locale + tenant), `@CurrentUser`, OpenAPI, and **`bootstrapAuricApp`**. | — | `/api` prefix, CORS, multipart |
| **bootstrap** | `SeedService`: idempotent seed of *platform* permissions, the wildcard `admin` role, and Core's AR/EN notification templates. | — | — |

**Core seeds only platform things** (`read:organization`, `manage:role`, `read:conversation`,
`send:message`, …). Product permissions/roles (`create:matter`, `firm_admin`, `manage:lead`, …) are
seeded by the product.

### 3.1 Request pipeline (identical for every product)

```
request → RequestContextMiddleware (correlation id, locale)
        → JwtAuthGuard (verify token, bind principal + active org)
        → tenant context (SET LOCAL app.organization_id / app.user_id inside the tx)
        → PermissionGuard (@RequirePermission, live DB check, in-tenant)
        → ZodValidationPipe
        → use case (owns the transaction) → repositories (Kysely + RLS)
        → audit + events.publish (same tx)
        → AppExceptionFilter maps any AppError → { error: { code, message, details } }
```

### 3.2 Multi-tenancy in one screen (`docs/tenancy.md`)

- **Tenant = organization.** `organization_id` everywhere; no parallel tenant concept.
- **Global identity**: one `users` row per human; `organization_members` is the link; a user can
  belong to many orgs. JWT carries an `org` claim (`string | null`); an org-less token is valid
  only on non-tenant routes (`/me`, list/create orgs). `POST /auth/refresh {organizationId}`
  switches tenant.
- **Shared schema + RLS.** Roles/permissions are global; `user_roles` carries `organization_id`
  ("admin in org A, viewer in org B").
- **Three DB roles**: `auric_owner` (migrations), `auric_app` (runtime, **no BYPASSRLS**),
  `auric_system` (BYPASSRLS — signup, webhooks, outbox worker). `unitOfWork.transaction` routes by
  `ctx.system`.
- Product tables you add: `organization_id NOT NULL` + an RLS policy, in the migration.

### 3.3 Events — which delivery to pick

| Reaction | Use |
|---|---|
| Only writes another row in the same DB | `registry.onInProcess` (synchronous, same tx) |
| Anything external: email, webhook, socket broadcast, e-invoice | `registry.onExternal` → outbox → worker (only fires if the tx committed, retried, DLQ) |

### 3.4 Public surface (`core/index.ts`, imported as `@core/index.js` or `@auric/core`)

Feature modules (`KernelModule`, `EventsModule`, `AuditModule`, `RbacModule`, `IdentityModule`,
`OrganizationsModule`, `NotificationsModule`, `FilesModule`, `MessagingModule`, `SecurityModule`),
`SeedService`, `migrateToLatest`, all DI tokens, contract types, RBAC seeding helpers
(`PermissionDefinition`, `RoleSeed`, `permKey`, `seedRbacDefinitions`), tenant helpers
(`requireOrganizationId`, `tenantContext`, …), assistant classes/types, and the messaging wire
contracts. Separately `core/http/bootstrap.ts` exports `bootstrapAuricApp`.

---

## 4. DI tokens (how domain code sees Core)

```ts
constructor(
  @Inject(USER_PROVIDER)         private readonly users: IUserProvider,
  @Inject(PERMISSION_PROVIDER)   private readonly perms: IPermissionProvider,
  @Inject(NOTIFICATION_PROVIDER) private readonly notify: INotificationProvider,
  @Inject(FILE_STORAGE)          private readonly files: IFileStorage,
  @Inject(AUDIT_LOGGER)          private readonly audit: IAuditLogger,
  @Inject(EVENT_BUS)             private readonly events: IEventBus,
  @Inject(TENANT_CONTEXT)        private readonly tenant: ITenantContext,
  @Inject(UNIT_OF_WORK)          private readonly uow: UnitOfWork,
) {}
```

| Group | Tokens |
|---|---|
| Kernel | `CONFIG`, `CLOCK`, `UNIT_OF_WORK`, `TENANT_CONTEXT`, `ERROR_TRACKER`, `WORKER_AUTOSTART` |
| Providers | `USER_PROVIDER`, `ORGANIZATION_PROVIDER`, `PERMISSION_PROVIDER`, `NOTIFICATION_PROVIDER`, `FILE_STORAGE`, `AUDIT_LOGGER`, `EVENT_BUS` |
| Identity / infra | `JWT_SERVICE`, `PASSWORD_HASHER`, `EMAIL_CHANNEL`, `STORAGE_ADAPTER`, `REQUIRE_EMAIL_VERIFICATION` |
| Assistant (**product supplies**) | `AI_CLIENT`, `ASSISTANT_CONFIG`, `ASSISTANT_TOOLS`, `ASSISTANT_DOMAIN_CONFIG`, `SCOPE_GUARD_CONFIG` |
| Messaging | `MESSAGING_PROVIDER` (read contract for product AI/features), `REALTIME_BROADCASTER` |

Tests override `CLOCK`, `UNIT_OF_WORK`, `AI_CLIENT` (with `ScriptedAiClient`), etc.

---

## 5. The four ways a product plugs into Core

1. **Compose** — import Core `@Module`s into the product's root `AppModule` (§6).
2. **Inject** — depend on tokens/interfaces, never on Core repositories or tables.
3. **Contribute** — export `PermissionDefinition[]`/`RoleSeed[]` (RBAC), notification templates,
   event subscribers, and (assistant) tools + prompt + scope vocabulary. Core provides the
   *mechanism*, the product supplies the *meaning*.
4. **Bootstrap** — call `bootstrapAuricApp({ module, identity, migrate, seed })` from `main.ts`
   (Core's boot order: migrate → build → configure HTTP → seed → listen).

---

## 6. How the two current projects use Core

Both are **separate deployments** — own process, port, Postgres database, `.env`, JWT secret, users,
orgs and roles. They share Core's **source** (relative import `@core/*`) and nothing at runtime.

### 6.1 Side-by-side

| | **Mizan** (Law Firm ERP) | **Atlas** (Real-Estate OS) |
|---|---|---|
| Backend root | `mizan/backend/app/app.module.ts` | `atlas/backend/app/app.module.ts` |
| Domain module | `LawfirmModule` → `mizan/backend/app/lawfirm/*` (clients, matters, hearings, tasks, documents, billing, time, staff, settings, dashboard, activity, calendar, admin, assistant, demo) | `RealestateModule` → `atlas/backend/app/realestate/*` (properties, sales, CRM, finance, operations, dashboard, lead-intelligence, conversation-intelligence, assistant, admin, demo) |
| Core modules imported | Kernel, Events, Audit, Rbac, Identity, Organizations, Notifications, Files, Security | same **+ `MessagingModule`** |
| Entry point | root `main.ts` → `bootstrapAuricApp` | `atlas/backend/main.ts` → `bootstrapAuricApp` |
| Prisma project | repo-root `prisma/` (Core tables + `lawfirm-*.prisma`) | `atlas/backend/prisma/` (Core baseline copied in + `realestate-*.prisma`) |
| Migrate | `core.migrateToLatest` (root Prisma project) | Atlas's own `scripts/migrate.ts` (same "shell `prisma migrate deploy`" approach, pointed at Atlas's Prisma project) |
| Seed | `AppSeedService`: Core `SeedService` + law-firm RBAC (`firm_admin`, `partner`, `lawyer`, `paralegal`, `finance`, `read_only`) | `AppSeedService`: Core `SeedService` + real-estate RBAC |
| AI Copilot | `lawfirm/assistant/` — matters/hearings/tasks tools, law-firm prompt + scope vocabulary, `use:assistant`, `POST /api/ai/chat` | `realestate/assistant/` — units/leads tools, real-estate prompt + scope, `ask:ai_conversation`; plus lead-intelligence (`StructuredAi`) |
| Messaging | **Not used yet** (a matter chat is the obvious first caller) | **Used** — `conversation-intelligence` reads conversations via `MESSAGING_PROVIDER`, analyses them with AI, stores insights, feeds the UI |
| Web | `mizan/web` (React 19 + Vite + Tailwind, Court Navy/Brass/Paper, Spectral + Public Sans + Amiri), real backend only (MSW is test-only) | `atlas/web` (React 19 + Vite + Tailwind 4; all colors in `src/styles/colors.ts`) |
| Mobile | `mizan/mobile` (Expo / expo-router, 18 screens) | — |
| Web ↔ Core | `@auric/web` transport + messaging contracts (in-place) | `@auric/web` transport + `@auric/contracts/messaging`; keeps its own axios layer |
| Deploy | AWS ARM VPS (systemd + nginx + Postgres 12), API at `https://100-26-109-162.sslip.io`; web on Vercel | Same VPS/cluster, separate Postgres **database**, own port/systemd unit (`docs/atlas-deployment.md`) |

Both roots are near-identical by design — the composition-root shape is the contract:

```ts
@Module({
  imports: [
    KernelModule, EventsModule, AuditModule, RbacModule, IdentityModule,
    OrganizationsModule, NotificationsModule, FilesModule,
    /* MessagingModule,  ← only if the product needs realtime chat */
    SecurityModule,
    /* <Product>Module, DemoModule */
  ],
  controllers: [HealthController],
  providers: [
    SeedService, AppSeedService, RequestContextMiddleware,
    { provide: APP_FILTER, useClass: AppExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(c: MiddlewareConsumer) { c.apply(RequestContextMiddleware).forRoutes("{*path}"); }
}
```

(`configure()` only runs on the *root* module, so the middleware and exception filter must be
re-applied by each product; Core's own `core/app.module.ts` is only the fixture for Core's
integration tests.)

### 6.2 What a product does per Core module

| Core capability | The product… |
|---|---|
| identity / organizations | Nothing — it gets `auth/*`, `me`, `organizations/*` for free. Web calls them. |
| rbac | Defines `PermissionDefinition[]` + `RoleSeed[]` in `permissions.ts`, seeds via `seedRbacDefinitions`. Decorates controllers with `@RequirePermission`. |
| tenancy | Adds `organization_id NOT NULL` + RLS to every product table; uses `currentExecutor()` repositories inside `unitOfWork.transaction`. |
| files | Injects `IFileStorage`/uses `/files/*` (presign → PUT → confirm) for documents/attachments; stores `file_id`. |
| audit | Calls `IAuditLogger.record()` in each sensitive use case. |
| notifications | Registers its own templates, calls `INotificationProvider.send()` from event subscribers. |
| events | Publishes `defineEvent` events; picks `onInProcess` vs `onExternal`. |
| messaging | Attaches meaning via `subjectType/subjectId/metadata`; reads through `MESSAGING_PROVIDER`; emits its own namespaced realtime events through `REALTIME_BROADCASTER`. |
| assistant | Writes its own `assistant.module.ts` listing Core's classes in `providers` **plus** its `ASSISTANT_TOOLS`, `ASSISTANT_DOMAIN_CONFIG`, `SCOPE_GUARD_CONFIG`; writes its own controller + permission. |
| localization | Uses `ar` default / RTL / `ar-EG` formatting; the web mirrors the same formatter rules. |

### 6.3 How the frontends touch Core

- **HTTP contract**: `/api/*` with a Bearer JWT; errors always `{ error: { code, message, details } }`.
- **`@auric/web`** (`packages/web`, source-only, aliased in Vite + tsconfig `paths`):
  `createHttpClient` (bearer, one retry via refresh on 401), `createTokenStore` (in-memory access,
  persisted refresh, safe without storage), `createRefresher` (**single-flight** — refresh tokens
  are single-use and reuse revokes the session), `ApiError`.
  Each app keeps its own endpoints, claim shape, storage key and domain API clients.
- **Messaging contracts**: `core/messaging/contracts/` consumed in place as
  `@auric/contracts/messaging` (types + realtime event constants; no copies, no drift test).
- **Vercel note**: because the webs import `../../packages` and `../../core/...`, the Vercel
  projects need **"Include source files outside of the Root Directory"** enabled.

---

## 7. What was extracted from products into Core (proof the process works)

Extraction happened only where Mizan **and** Atlas had independently written the same thing
(`docs/core-extractions.md`):

| Extracted to Core | Product keeps |
|---|---|
| Prefixed NanoID factory (`createPrefixedId`) | its own prefixes |
| RBAC contracts (`PermissionDefinition`, `RoleSeed`, `permKey`) | its permissions, roles, seed data |
| `UserDirectory` | — |
| **`core/assistant`** (client, tool registry, scope guard, conversation store, agent loop, response guard) | tools, system prompt, scope vocabulary, permissions, controller |
| `StructuredAi` (prompt → JSON → validate → repair) + `ScriptedAiClient` test double | lead-intelligence prompt + schema |
| `bootstrapAuricApp` | root module, migrate fn, seed fn, identity |
| `@auric/web` transport | endpoints, domain clients, claim shape |
| Messaging wire contracts | Atlas insights contract stays Atlas-owned |

**Deliberately not extracted** (single caller or product-semantic): assistant controllers/modules,
conversation analysis (`atlas/.../conversation-intelligence` — *future candidate the day Mizan
adopts messaging*), admin adapters, demo seeders, search ranking, design systems, page chrome,
deploy scripts.

**Known remaining duplication**: each web has its own auth provider, query client, upload helper,
design primitives and toast/confirm components; each backend has its own assistant module wiring
(by design); Atlas has its own `migrate.ts` because Core's `migrate.ts` hard-codes the repo-root
Prisma project.

---

## 8. Upcoming projects — how each will use Core

There is **no third product in the repo yet**, so nothing below is built; it is the intended path,
derived from `Plan.md`, `docs/system-architecture.md` and what Atlas already proved.

### 8.1 What every new project gets on day one

Everything in §3 with **zero** new platform code: sign-up/login/refresh, orgs + membership +
switcher, RBAC engine, RLS tenancy, presigned file uploads (local/R2), audit trail, bilingual
notifications + outbox, health/readiness, error envelope, OpenAPI, structured logs, and — if it
opts in — realtime messaging and the AI-copilot engine.

### 8.2 The recipe (Atlas is the worked example — it took Mizan's shape)

1. **Scaffold** `<product>/backend/app/` with `app.module.ts`, `main.ts`, `seed.ts`, `version.ts`,
   `<domain>/` (mirror Atlas; the roots are the template).
2. **Compose**: copy the root module above; import only the Core modules needed (`MessagingModule`
   is opt-in; skip it if the product has no chat).
3. **Own database**: new Postgres database (same cluster is fine — databases are a hard boundary),
   own `AURIC_DATABASE_URL`, `AURIC_APP_DATABASE_URL`, `AURIC_SYSTEM_DATABASE_URL`, own
   `AURIC_JWT_SECRET`, own port.
4. **Own Prisma project** (`<product>/backend/prisma/`): the Core baseline migrations copied in
   (identity, rbac, org, files, audit, notifications, events, multitenancy columns + RLS,
   `core_assistant`, `core_messaging` as needed) followed by the product's `<domain>-*.prisma`
   models and migrations. Add `organization_id NOT NULL` + RLS policy to each product table; hand-add
   CHECKs/triggers to the migration; `db:generate` for Kysely types. Copy Atlas's `migrate.ts`.
5. **Permissions + seed**: `permissions.ts` (`PermissionDefinition[]`, `RoleSeed[]`); `AppSeedService`
   = Core `SeedService` + `seedRbacDefinitions`.
6. **Domain modules** in the standard anatomy; consume Core by token; each use case owns its
   transaction; publish events; audit sensitive operations; add templates for notifications.
7. **Optional AI**: product `assistant.module.ts` (tools over its *existing* services, prompt, scope
   vocabulary, controller + permission). Reuse `StructuredAi` for JSON-extraction features.
8. **Web**: Vite alias `@auric/web` for transport; alias `@auric/contracts/messaging` if realtime;
   own auth provider/design system; mirror `ar-EG` / RTL rules from `core/localization`.
   **Mobile**: separate Expo client of the same API (Mizan mobile is the reference).
9. **Deploy**: `bootstrapAuricApp` boots it; per-product systemd unit + nginx location + `.env`
   (see `docs/deployment.md`, `docs/atlas-deployment.md`); web on Vercel.
10. **Tests**: unit (pure domain), integration against a throwaway Postgres including
    **tenant A ⊗ tenant B**, unauthorized-blocked, RLS-not-bypassable, outbox-once.

### 8.3 What a new project must NOT do

- Put product concepts in `core/` (or fork Core "just for us").
- Reach into `core/<module>/{domain,application,infrastructure}` — use tokens + `core/contracts`.
- Query another module's tables or duplicate identity (store `userId`, call `IUserProvider`).
- Add Redis/Elasticsearch/microservices/a plugin system before a real requirement exists.

### 8.4 Where the "next" projects are most likely to pull Core forward

These are candidates, **not promises**, and each waits for real second/third usage:

| Candidate | Trigger |
|---|---|
| Conversation analysis (coalescing, single-flight, retry, persistence) from Atlas → `core/messaging` or a sibling | Mizan (or a 3rd product) adopts messaging |
| Web auth provider, query client, upload helper | A 3rd frontend needs them |
| Generic `migrate` that accepts a package root (removes Atlas's copy) | A 3rd product with its own Prisma project |
| Admin adapters / demo seeders | 3rd product |
| Domain modules (Documents, Tasks, CRM/Clients, Billing, Approvals, Scheduling, HR, Projects, Reporting) | Same domain built **three** times → forkable `modules/<name>/` starting point |
| `packages/contracts` (API DTOs, permission ids, enums) | Proven cross-client need; today only messaging contracts are shared |
| Per-tenant custom roles (`organization_id` on `roles`/`role_permissions`) | A tenant needs roles it defines itself (documented in `tenancy.md`) |
| `/api/v1` versioning | A second API consumer or a breaking change |
| Redis, push notifications, search engine | Real load / requirement |

**Extraction procedure**: build in the product → a second product writes the same thing → compare →
extract only the identical part behind a Core interface/token → each product keeps its
vocabulary/wiring → record it in `docs/core-extractions.md` (including what you *chose not* to
extract and why).

---

## 9. Repository reality vs. the long-term plan

`Plan.md` §10.3 describes the *mature* shape: Core as a **versioned, pinned package**, each client
in its own repo/folder pinning its own Core version, `modules/` earned by three builds.
**Today** is the pragmatic first stage of that:

- One repo. `core/` at the root; `mizan/` and `atlas/` beside it. Products import Core **source** by
  relative alias (`@core/*` → `../../core/*` in Atlas; `@core/*` + `@app/*` in Mizan; the web apps
  use `@/*`). Core also exposes `"."`/`"./contracts"` in `package.json` (`@auric/core`).
- Consequence: **a Core change reaches every product on its next build.** There is no version pin
  yet, so Core changes must stay backward compatible or be rolled out to Mizan and Atlas together.
  `CORE_VERSION` exists (`core/version.ts`, `0.1.0`) for when pinning starts.
- The Plan/system-architecture text about "each future client is its own repo consuming pinned Core"
  is the destination; when a client that is *not* ours arrives (or when Core changes start to
  risk a shipped product), that is the moment to cut Core into a published package. Do not do it
  earlier (§47 rule 17).

Also note: `docs/system-architecture.md` still shows Mizan as "Project #1, one client" and says "no
`client-00N/`". Atlas as Project #2 (in-repo, separate deployment) is the current reality and the
first proof that Core is genuinely reusable.

---

## 10. Configuration reference (`AURIC_*`)

Parsed and validated in `core/kernel/config.ts`; a bad env fails at boot.

| Area | Variables |
|---|---|
| Process | `AURIC_PORT`, `AURIC_LOG_LEVEL`, `AURIC_APP_NAME`, `AURIC_APP_URL` |
| Database | `AURIC_DATABASE_URL` (owner/migrations), `AURIC_APP_DATABASE_URL` (`auric_app`), `AURIC_SYSTEM_DATABASE_URL` (`auric_system`, BYPASSRLS) |
| Auth | `AURIC_JWT_SECRET` (required in prod), `AURIC_ACCESS_TOKEN_TTL`, `AURIC_REFRESH_TOKEN_TTL` |
| HTTP | `AURIC_CORS_ORIGINS` (`*.example.com` → suffix match, e.g. Vercel previews) |
| Locale | `AURIC_DEFAULT_LOCALE`, `AURIC_SUPPORTED_LOCALES` |
| Files | `AURIC_FILE_STORAGE_DRIVER` (`local`\|`r2`), `AURIC_FILE_STORAGE_PATH`, `AURIC_R2_*`, `AURIC_FILE_PRESIGN_TTL_SECONDS`, `AURIC_FILE_MAX_UPLOAD_BYTES`, `AURIC_FILE_ALLOWED_MIME_TYPES` |
| Mail | `AURIC_MAIL_FROM`, `AURIC_SMTP_URL` |
| Outbox | `AURIC_OUTBOX_POLL_INTERVAL_MS`, `AURIC_OUTBOX_MAX_ATTEMPTS`, `AURIC_OUTBOX_BATCH_SIZE` |
| AI | `AURIC_AI_*` (provider/base URL/key/model/limits → `assistantConfigFromAuricConfig`) |

Product-level toggles (e.g. `ATLAS_SEED_DEMO`) live in the product, not in Core config. Secrets live
only in the server `.env`, never in the repo.

---

## 11. Working with Core day to day

```bash
npm run dev               # boot Mizan (root main.ts) with watch
npm run typecheck | lint | test
npm run migrate           # prisma migrate deploy (root Prisma project)
npm run migrate:dev -- --name <change>
npm run db:generate       # regenerate core/kernel/db/schema.ts (Kysely types)
npm run build && npm start
# Atlas: same scripts inside atlas/backend
```

- Tool shells here have a stale PATH → `export PATH="/c/nvm4w/nodejs:$PATH"` before `node`/`npm`.
- Node `^22.12 || >=24` (Prisma won't install on odd majors).
- Core integration tests need `AURIC_TEST_DATABASE_URL` (throwaway Postgres).
- A new Core module ships domain + use-case + repository/integration + API tests **before** it is
  wired into any composition root.

**Changing Core** (because it is shared source today): run Mizan's *and* Atlas's backend test suites
and typecheck before merging; never add a product word to Core; if a change alters a table, both
Prisma projects need a migration (Atlas carries its own copy of Core's baseline).

---

## 12. Testing map

| Layer | What proves what |
|---|---|
| Core unit | Domain logic with no DB (pure) |
| Core integration (`core/tests/`) | Boots Core on throwaway Postgres: unauthorized blocked, permission change effective, **tenant A ⊗ B** (`tenancy.integration.test.ts`), RLS not bypassable, outbox exactly-once |
| Messaging | Each of the 10 rules has a test; a vocabulary-leak test fails if product words enter `core/messaging` |
| Assistant | `ScriptedAiClient` (in `core/assistant/tests`) lets products test tools/prompts without a live LLM. (Atlas's `assistant-live.integration.test.ts` calls real Groq and fails on 429 quota — not a regression.) |
| Products | Own domain/use-case/API tests; Mizan backend 124 + web 78 at last recorded green; `mizan/web` `calendar-page.test.tsx` had a known date-relative flake (since fixed in `e4bc310`) |

---

## 13. Known gaps / honest caveats

- No Core version pinning yet (§9) — shared-source coupling between Mizan and Atlas.
- Atlas duplicates Core's baseline migrations and a small `migrate.ts` (Core's runner is
  root-project-only).
- Mizan does not use messaging yet; conversation-intelligence is Atlas-only, so it is not in Core.
- Web layer duplication remains (§7).
- `core/README.md` should be refreshed to list `assistant` + `messaging` in §4–§7 (this doc already
  does).
- Backend mounts at `/api` (unversioned); `/api/v1` is a destination item.
- Only local-disk and R2 storage adapters, only one LLM implementation (OpenAI-compatible/Groq), no
  Redis, no push channel — all deliberately deferred until a requirement exists.

---

## 14. Where to read next

| Topic | File |
|---|---|
| Governing rules / constitution | `Plan.md` |
| Core as-built | `docs/architecture.md`, `core/README.md`, `core/<module>/README.md` |
| Vision + boundaries | `docs/system-architecture.md`, `docs/mizan-project-one.md` |
| Building on Core | `docs/integration-guide.md`, `docs/conventions.md` |
| Multi-tenancy | `docs/tenancy.md` |
| Database | `docs/database-erd.md`, `prisma/README.md` |
| Messaging | `docs/messaging.md`, `core/messaging/README.md` |
| AI copilot | `docs/assistant.md`, `docs/atlas-assistant.md`, `docs/lead-intelligence.md`, `core/assistant/README.md` |
| Uploads | `docs/uploads-and-assistant.md`, `core/files/README.md` |
| What moved into Core | `docs/core-extractions.md` |
| Deployment | `docs/deployment.md`, `docs/atlas-deployment.md` |
| Engineering deep-dive | `docs/engineering-overview.md` |
| Shared web transport | `packages/web/README.md` |
