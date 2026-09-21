# Building on AURIC with `create-auric`

> **Generate the foundation. Own the source. Build your product.**

## What AURIC Core is

Every multi-tenant SaaS starts by rebuilding the same infrastructure: users and sign-in, organizations
(tenants), roles and permissions, file uploads, notifications, real-time messaging, an audit trail —
and a database that never leaks one customer's rows to another. **AURIC Core** is that foundation,
already built, tested and secured with PostgreSQL row-level security.

`create-auric` **generates it into your own project.** There is no `@auric/core` package to install,
no version to keep in sync, no black box. After generation the code in `src/core/` and the migrations
in `prisma/migrations/` are ordinary files in your repository. Read them, change them, delete what you
don't need. The scaffolder never runs again unless you want it to.

```
        AURIC Core (yours after generation)          Your product
   ─────────────────────────────────────────    ───────────────────────
    Identity · Organizations · RBAC              Property · Unit · Lead
    Files · Notifications · Messaging            Customer · Deal · …
    Assistant · Audit · Multi-tenancy · RLS
```

Core never needs to know what a `Property` is. Your tables reference Core's `organizations` and
`users`; Core stays generic.

## Create a project

You need **Node.js 22.12+** and a **PostgreSQL** database you can create roles in.

```bash
npx create-auric
```

The prompt asks for a project name, then which modules to add, shows what got pulled in and why,
summarises, and generates. Prefer no prompts?

```bash
npx create-auric acme-platform --modules files,messaging --yes
```

| Flag | |
|---|---|
| `-m, --modules <list>` | modules to include, comma-separated (skips the picker) |
| `-y, --yes` | accept defaults and ask nothing |
| `--install` / `--no-install` | install dependencies after generating (asked interactively; off with `--yes`) |
| `--verbose` | generation details and full error output |
| `-h, --help`, `-v, --version` | |

`create-auric` **never overwrites**: if the target directory exists and isn't empty it stops. If
generation fails part-way it removes what it wrote.

## Choosing modules

**The foundation is always included** — Base, Identity, Organizations and RBAC. They reference each
other (sign-in needs tenant memberships, roles are per-tenant, …) so they are one unit, not separate
choices.

Add any of these:

| Module | Gives you | Also installs |
|---|---|---|
| **Files** | presigned uploads, local-disk and Cloudflare R2 storage | — |
| **Notifications** | in-app inbox, transactional email over an outbox, bilingual templates | — |
| **Messaging** | real-time conversations, attachments, reactions (Socket.IO) | Files |
| **Assistant** | tool-calling AI agent loop, scope guard, conversation store | — |

The picker shows the reason for every dependency ("Messaging requires Files — message attachments").
Dependencies are resolved from the module manifests; you cannot generate a project with a missing one.

> **Skipping Notifications.** Identity normally requires a verified email before sign-in, and only
> Notifications can send that email. Without it the project is generated with verification **switched
> off** — new accounts sign in immediately — and `auric.json` records `"emailVerification": false`.
> Add Notifications later and re-enable verification in `src/core/identity/identity.module.ts`.

## What you get

```
acme-platform/
├─ auric.json                 what was generated, by which version
├─ package.json               only the dependencies your modules need
├─ .env.example               only the variables your modules read
├─ prisma/
│  ├─ schema/                 one .prisma file per installed module
│  └─ migrations/
│     ├─ 20260101000000_auric_baseline/   tables, keys, checks, triggers, indexes
│     └─ 20260101000001_auric_security/   roles, grants, row-level security
├─ scripts/                   migrate · provision-db · build
└─ src/
   ├─ main.ts
   └─ core/                   AURIC Core — your code now
      ├─ app.module.ts        composition root
      ├─ kernel/ http/ events/ audit/ …
      └─ identity/ organizations/ rbac/ [files/ notifications/ messaging/ assistant/]
```

`src/core/README.md` documents exactly what was installed. The Kysely query types
(`src/core/kernel/db/schema.ts`) are already generated for your tables — the project type-checks
before you run `npm install`.

## First run

```bash
cd acme-platform
createdb acme_platform       # a NEW, EMPTY database — the migrations create every table themselves
cp .env.example .env         # AURIC_DATABASE_URL already points at it (named after your project)
npm install
npm run migrate              # applies prisma/migrations
npm run provision-db         # gives the two runtime roles a login (uses the *_DB_PASSWORD vars)
npm run dev
```

Then point `AURIC_APP_DATABASE_URL` and `AURIC_SYSTEM_DATABASE_URL` at those roles. **Until you do,
the app connects as the schema owner and row-level security is not enforced.**

Health check: `GET /api/health`. API docs: `/api/docs`.

**The database must be empty.** The first migration creates every table, so it fails with
`relation "audit_logs" already exists` if `AURIC_DATABASE_URL` points at a database that already has AURIC
tables — another AURIC project, or an earlier copy of this one. Create a fresh database instead. If Prisma
recorded the failed attempt in a database you want to keep, clear it with
`npx prisma migrate resolve --rolled-back <migration name from the error>`.

### Environment variables

`.env.example` lists only the variables of the modules you installed, grouped by module, with a
description of each. Secrets ship as `CHANGE_ME`; boot refuses the default JWT secret in production.
Skipping a module removes its variables — nothing mysterious is left over.

## The database, and who owns it

The two migrations are generated from *your* selection: only the tables of the modules you chose,
with the constraints, triggers and security policies Prisma's schema language can't express. They
are yours from the first commit — edit them before your first deploy, and add every later change as a
new migration:

```bash
npm run migrate:dev -- --name add_properties     # prisma migrate dev
npm run db:generate                              # refresh the typed query interface
```

Core's own migration history (the one AURIC's products use) is **not** copied; you start clean.

### Tenancy and row-level security

Every tenant-scoped table has an `organization_id` and a policy that only lets a request see and write
its own tenant's rows. The database enforces it, so a forgotten `WHERE` clause cannot leak data.

- **`auric_app`** — the role requests run as. `NOBYPASSRLS`: every query is filtered.
- **`auric_system`** — `BYPASSRLS`, for sign-up, webhooks and the background outbox worker.
- The active tenant travels as `app.organization_id`, set per transaction from the signed-in user.

`npm run migrate` creates the roles (this needs a superuser connection, or roles you created by hand
first); `provision-db` gives them passwords.

### RBAC

Roles and permissions are seeded on boot from each module's permission catalog
(`src/core/*/permissions/permissions.ts`), registered in `src/core/bootstrap/seed.service.ts`. Guard a
route with `@RequirePermission("read", "property")`; the check runs live against the caller's active
tenant. An `admin` role holding every permission is created for you.

### Messaging

Included with `--modules messaging` (which pulls in Files for attachments). Conversations, messages,
attachments and reactions live in `src/core/messaging/`; real-time delivery is Socket.IO, scoped per
tenant and authorised with the same RBAC permissions as the REST routes. Add your own event
consumers by subscribing to the events it publishes; see `src/core/messaging/README.md`.

### Assistant

Included with `--modules assistant`. It is a provider-agnostic, tool-calling agent loop with a scope
guard and a conversation store — you register tools that call your own use cases, and each tool is
checked against the caller's permissions. Configure the provider with `AI_PROVIDER` (`groq` or
`openai`), `AI_API_KEY`, and optionally `AI_MODEL`, `AI_BASE_URL`. Without a key the module still
boots; chat requests fail with a clear error. See `src/core/assistant/README.md`.

## Adding your business domain

A worked example: **a real-estate SaaS.** You generate with `--modules messaging` (so: Identity,
Organizations, RBAC, Files, Messaging). AURIC gives you sign-in, tenants, roles, uploads and chat.
*You* add the business: **Property, Unit, Lead, Customer, Deal.** Those tables, their rules and their
screens are yours; Core has no idea they exist.

**1. Model it** — `prisma/schema/property.prisma`. Reference Core's tables; give tenant data an
`organization_id`:

```prisma
model properties {
  id              String        @id
  organization_id String
  owner_id        String
  title           String
  created_at      DateTime      @default(now()) @db.Timestamptz(6)

  organization organizations @relation(fields: [organization_id], references: [id], onDelete: Cascade)
  owner        users         @relation(fields: [owner_id], references: [id])

  @@index([organization_id])
  @@map("properties")
}
```

Prisma needs both sides of a relation, so add `properties properties[]` to the `organizations` and
`users` models in `prisma/schema/organizations.prisma` and `identity.prisma` — they're your files.

**2. Migrate and protect it.** `npm run migrate:dev -- --name add_properties`, then add row-level
security to the new migration (copy the pattern from `*_auric_security`):

```sql
ALTER TABLE "properties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "properties" FORCE  ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "properties"
  USING      (organization_id = current_setting('app.organization_id', true))
  WITH CHECK (organization_id = current_setting('app.organization_id', true));
```

The runtime roles already have the right privileges on new tables. Run `npm run db:generate`.

**3. Build the feature** — a Nest module beside Core, e.g. `src/domain/property/`:

```ts
@Injectable()
export class PropertyRepository {
  list() {
    return currentExecutor().selectFrom("properties").selectAll().execute(); // RLS scopes it
  }
  create(input: { title: string; ownerId: string }) {
    return currentExecutor()
      .insertInto("properties")
      .values({ id: createPrefixedId("prop"), organization_id: requireOrganizationId(), owner_id: input.ownerId, title: input.title })
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}

@Controller("properties")
@UseGuards(JwtAuthGuard, PermissionGuard)
export class PropertyController {
  @Get() @RequirePermission("read", "property")
  list() { return readInTenant(() => this.repo.list()); }
}
```

with `currentExecutor`/`readInTenant` from `@core/kernel/db/db.js`, `requireOrganizationId` from
`@core/kernel/tenant.js`, `createPrefixedId` from `@core/kernel/id.js`, and the guards and decorators
from `@core/http/…`. Then:

- add `{ action: "read", resource: "property", description: "View properties" }` to a permission
  catalog and register it in `seed.service.ts`;
- import your module in `src/core/app.module.ts`.

**4. Use the rest of Core on it.** Attach a chat to a deal with Messaging's `subjectType` /
`subjectId` (`"deal"`, the deal's id); attach photos to a property with Files' presigned uploads.
Neither module knows what a deal or a property is.

## Extending or removing Core

It's your code. Add a column to `users`, rename a permission, swap the email transport, delete the
`assistant` folder you never used. Keep Core's tests running (`npm test`) — they run against your
migrations and are the quickest way to notice you broke a tenancy rule.

**Assistant.** The Assistant module is infrastructure only: the agent loop, scope guard and
conversation store. *You* supply the tools and prompt by providing `ASSISTANT_TOOLS`,
`ASSISTANT_DOMAIN_CONFIG` and `SCOPE_GUARD_CONFIG` (see `src/core/assistant/`). Set `AI_API_KEY`.

**Messaging.** Conversations are tenant-scoped, membership-checked and ordered per conversation; the
Socket.IO gateway authenticates with the same JWT as the REST API. Attachments reference stored files.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Directory "x" already exists and isn't empty` | `create-auric` never overwrites. Pick another name. |
| `Prisma could not generate the database schema` | Needs Node 22.12+. Re-run with `--verbose`. |
| `permission denied to create role` on `migrate` | Roles need a superuser. Create `auric_app` (`NOBYPASSRLS`) and `auric_system` (`BYPASSRLS`) yourself first — the migration then skips them. |
| App runs but tenant data isn't isolated | `AURIC_APP_DATABASE_URL` / `AURIC_SYSTEM_DATABASE_URL` aren't set, so it's connecting as the owner. |
| Users can register but never receive an email | Notifications isn't installed (verification is off), or `AURIC_SMTP_URL` is unset — without it email is logged, not sent. |
| Dependency install failed during generation | The project is intact. Run `npm install` yourself. |
| Argon2 / native module errors on install | Your npm may block dependency install scripts. Allow them for `argon2`, `@prisma/engines`, `@swc/core`, `esbuild`. |
| Anything else | `npx create-auric --verbose …` prints the full error. |
