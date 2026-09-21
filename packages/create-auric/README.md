# create-auric

**Build your foundation. Own your code.**

```bash
npx create-auric
```

AURIC Core is a modular backend foundation that you scaffold directly into your own project:
identity, organizations, roles & permissions, files, notifications, messaging and an AI-assistant
runtime, on PostgreSQL with row-level security. You pick the modules; `create-auric` resolves their
dependencies, generates the database schema and security policies for exactly that selection, and
hands over the source.

There is no `@auric/core` runtime dependency. The code lands in `src/core/`, the migrations in
`prisma/migrations/`, and both are yours to read, change and delete.

**What it is not:** not a hosted service, not a platform you sign up to, not a framework package you
depend on and upgrade. It is starter source that becomes yours the moment it is generated. Your
business domain (properties, customers, orders…) lives beside it and references Core's `users` and
`organizations`; Core never needs to know what those are.

## Usage

```bash
npx create-auric                                   # interactive
npx create-auric acme-platform                     # name given, choose modules
npx create-auric acme-platform --modules files,messaging --yes
```

| Option | |
|---|---|
| `-m, --modules <list>` | modules to include, comma-separated |
| `-y, --yes` | accept defaults, ask nothing |
| `--install` / `--no-install` | install dependencies after generating |
| `--verbose` | generation details and full errors |
| `-h, --help` · `-v, --version` | |

Requires **Node.js 22.12+** and a **PostgreSQL** database.

## Modules

The foundation — **Base, Identity, Organizations, RBAC** — is always included. Add any of:

| Module | |
|---|---|
| `files` | presigned uploads, local disk or Cloudflare R2 |
| `notifications` | in-app inbox and transactional email |
| `messaging` | real-time conversations (also installs `files`) |
| `assistant` | tool-calling AI agent runtime |

## After generating

You need Node.js 22.12+ and a running PostgreSQL.

```bash
cd acme-platform
createdb acme_platform    # a NEW, EMPTY database — never reuse an existing one
cp .env.example .env      # AURIC_DATABASE_URL already points at that database
npm install               # skip if create-auric already ran it
npm run migrate           # creates the tables and row-level-security policies
npm run dev               # then open http://localhost:3000/api/health
```

Before you put real data in, run `npm run provision-db` and point `AURIC_APP_DATABASE_URL` /
`AURIC_SYSTEM_DATABASE_URL` at the two roles it sets up — until then row-level security is not enforced.

The generated project's own `README.md` walks through all of this, explains how sign-in, tenants and
permissions work, and lists fixes for the errors people hit (including
`relation "audit_logs" already exists`, which means the database wasn't empty). The full guide —
the ownership model, tenancy, adding your own domain models — is in `docs/create-auric.md`.

## What it never does

It never overwrites an existing directory, never phones home, and never needs network access to
generate (only `npm install` does).

## License

MIT

---

Developed by **JINX**.
