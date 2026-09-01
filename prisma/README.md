# prisma/

Prisma owns the **schema definition** and the **migration history** (Plan §2).
Types flow **Prisma → Kysely**: Prisma Client is never generated — the only
generator is `prisma-kysely`, which emits `core/kernel/db/schema.ts` (the
`Database` interface every repository types against). Kysely runs every query;
Prisma never touches a runtime query path — only migrations.

## Layout

| Path | What |
|---|---|
| `../prisma.config.ts` | Prisma 7 config — loads `.env`, points at `prisma/schema/`, datasource URL from `AURIC_DATABASE_URL` |
| `schema/datasource.prisma` | datasource + the `prisma-kysely` generator |
| `schema/<module>.prisma` | one file per Core module, models mirroring that module's tables (`@@map` / `@map` keep the snake_case names) |
| `migrations/` | Prisma migration history, applied with `prisma migrate deploy` |

## Workflow

```bash
npm run db:generate                    # regenerate core/kernel/db/schema.ts
npm run migrate                         # prisma migrate deploy (apply pending)
npm run migrate:status                  # prisma migrate status
npm run migrate:dev -- --name <change>  # author a new migration during dev
npm run db:pull                         # re-introspect the DB into the schema
```

`core/kernel/db/schema.ts` is **generated** — do not hand-edit it. Change a
`prisma/schema/*.prisma` model and run `npm run db:generate`. `../core/kernel/db/json.ts`
is hand-written (the `Json<T>` column helper the generated file imports).

At runtime, `core.migrate()` (via `core/kernel/db/migrate.ts`) shells
`prisma migrate deploy` with `AURIC_DATABASE_URL` pointed at the caller's DB.

## What Prisma's schema language can't express

Prisma models can't carry these, so they're hand-written into
`migrations/20260829120100_constraints_triggers_indexes/migration.sql`. A
`/// @kyselyType(...)` annotation narrows the Kysely type where it matters, but
the DB object itself is in the migration:

- CHECK constraints backing the string-union columns
  (`users.status`, `verification_tokens.purpose`, `audit_logs.actor_type`,
  `files.visibility`, `notification_templates.channel`, `outbox_messages.status`)
- `auric_set_updated_at()` + the `users` / `roles` / `organizations` /
  `notification_templates` per-table triggers
- the `audit_logs` append-only (immutability) trigger
- the partial index `outbox_ready_idx` on `outbox_messages`
- the `citext` extension (`CREATE EXTENSION` prepended to the baseline migration)

The multi-tenancy row-level-security policies, the `auric_app` / `auric_system`
roles, and their grants are likewise hand-written, in
`migrations/20260901120100_multitenancy_rls/migration.sql` (§ docs/tenancy.md).
A new tenant-scoped table needs its own `ENABLE`/`FORCE ROW LEVEL SECURITY` +
policy added to its migration.

Keep the constraints/triggers migration in sync by hand when a
`/// @kyselyType('a' | 'b')` union changes or a table gains/loses `updated_at`.

## Baselining an existing database

A database already migrated by the old Kysely migrator is marked up to date
without re-running the baseline:

```bash
psql "$AURIC_DATABASE_URL" -c 'DROP TABLE IF EXISTS auric_migrations, auric_migrations_lock;'
npx prisma migrate resolve --applied 20260829120000_baseline
npx prisma migrate resolve --applied 20260829120100_constraints_triggers_indexes
```
