# prisma/

Prisma owns the **schema definition** here; it does not run at runtime and it
does not (yet) own migrations. Plan §2: types flow **Prisma → Kysely**. Prisma
Client is never generated — the only generator is `prisma-kysely`, which emits
`core/kernel/db/schema.ts` (the `Database` interface every repository types
against).

## Layout

| Path | What |
|---|---|
| `../prisma.config.ts` | Prisma 7 config — loads `.env`, points at `prisma/schema/`, sets the datasource URL from `AURIC_DATABASE_URL` |
| `schema/datasource.prisma` | datasource + the `prisma-kysely` generator |
| `schema/<module>.prisma` | one file per Core module, models mirroring the tables that module's Kysely migrations create (`@@map` / `@map` keep the snake_case names) |

## Workflow

```bash
npm run db:generate   # prisma generate → regenerates core/kernel/db/schema.ts
npm run db:pull       # prisma db pull  → re-introspect the DB into the schema
```

`core/kernel/db/schema.ts` is **generated** — do not hand-edit it. Change a
`prisma/schema/*.prisma` model and run `npm run db:generate`. `json.ts` beside
it is hand-written (the `Json<T>` column helper the generated file imports).

## What Prisma can't express

These live in `core/*/migrations/` and stay there — a `/// @kyselyType(...)`
annotation narrows the Kysely type where it matters, but the DB objects
themselves are not in this schema:

- CHECK constraints backing the string-union columns
  (`users.status`, `verification_tokens.purpose`, `audit_logs.actor_type`,
  `files.visibility`, `notification_templates.channel`, `outbox_messages.status`)
- the `auric_set_updated_at` trigger + per-table triggers
- the `audit_logs` immutability trigger
- the partial index `outbox_ready_idx` on `outbox_messages`
- the `citext` extension (created by the bootstrap migration)

## Not done yet: the migrator cutover

Migrations are still owned by the Kysely migrator (`core/kernel/db/migrator.ts`
+ `migrations-manifest.ts` + `scripts/migrate.ts`). Replacing that with
`prisma migrate deploy` — including a baseline migration and a hand-written
follow-up for the objects listed above — is the remaining step. See
`docs/integration-guide.md` § "The Prisma cutover".
