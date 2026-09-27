# HotelOS — architecture and decisions

HotelOS is the operations platform behind **Hotel Nayel**, the third AURIC product after Mizan
(law firms) and Atlas (real estate). This file records the decisions that shape it and, more
importantly, *why* — so a future change can tell a deliberate constraint from an accident.

Status: **Slice 0 (foundation) complete.** Sections marked *(planned)* describe the locked design
for later slices; they become as-built as each slice lands.

## 1. Topology

```text
hotel-project/
├── backend/   HotelOS API — NestJS on Fastify, AURIC Core by source (@core/*), hotel domain (@hotel/*)
├── app/       HotelOS staff application — React 19 + Vite + Tailwind 4, talks only to backend/
└── web/       the public Hotel Nayel website (existing) — will consume the public booking API
```

The backend follows `atlas/backend` exactly: a **separate deployment** with its own process, port
(3200), Postgres database, JWT secret, users and organizations. Core's source is compiled into it
through the `@core/*` alias; nothing else is shared with Mizan or Atlas. It has no npm
dependencies of its own — everything resolves from the repo root, so there is exactly one copy of
Nest/Fastify/Kysely (a second copy breaks Nest DI's metadata registry).

| Concern | Where | Pattern source |
|---|---|---|
| Boot | `main.ts` → `bootstrapAuricApp` (migrate → build → seed → listen) | Core |
| Composition | `app/app.module.ts` (Core modules + `HotelModule` + `DemoModule`) | Atlas |
| Migrations | `prisma/migrations/` via `scripts/migrate.ts` (`prisma migrate deploy`) | Atlas |
| Typed DB | `app/hotel/db/schema.ts` (generated) + `hotelDb()` | Atlas `realestateDb()` |
| Seed | `app/seed.ts`: Core seed → hotel RBAC → opt-in demo (`HOTEL_SEED_DEMO`) | Atlas |
| Product config | `app/config.ts` (only `HOTEL_*` vars; Core keeps `AURIC_*`) | new, Core's fail-fast style |

Core modules in use: kernel, events + outbox, audit, rbac, identity, organizations,
notifications, files, security/http. **Messaging is not imported** — nothing in a hotel needs
real-time chat — but its tables exist because the copied Core baseline is kept complete.

## 2. Database

- **Core baseline** — the Core migrations are copied verbatim from the repo root
  (`20260829…` → `20260918…`), as Atlas does. `20260916120000_core_assistant` is the plain create
  of Core's AI tables (Mizan renamed its own tables into them; Atlas dropped and recreated).
- **Hand-written SQL, Prisma for types.** Hotel tables are authored as SQL migrations and mirrored
  by `prisma/schema/hotel-*.prisma` models used only to generate Kysely types
  (`npm run db:generate`). Prisma cannot express the exclusion constraints, composite FKs, CHECKs
  and RLS policies this schema depends on.
- **Tenancy** — organization = tenant, exactly as Core defines it. Every tenant-scoped table has
  `organization_id`, `ENABLE` + `FORCE ROW LEVEL SECURITY` and a `tenant_isolation` policy. The
  foundation integration test asserts this for **every** table with an `organization_id` column,
  so a new table that forgets RLS fails CI. v1 is **one property per organization**; nothing in
  the model assumes the organization *is* the property beyond that one-row settings table, so a
  `property_id` can be introduced later.
- **Money** — `numeric(14,2)` EGP, as in Mizan billing. Never floats, never client-supplied.
- **Hotel dates** — nights are `date` values in the hotel's time zone (Africa/Cairo); "today"
  comes from the injected `Clock` + the hotel's zone, never UTC midnight.

## 3. No double booking *(constraint planned for Slice 2; prerequisite installed in Slice 0)*

The invariant lives in the database, not in the application:

```sql
EXCLUDE USING gist (organization_id WITH =, room_id WITH =, stay WITH &&) WHERE (active)
```

on the room-allocation table, where `stay` is a `daterange` `[arrival, departure)` (half-open, so a
departure and the next arrival on the same day do not collide). Mixing `=` on a text column with
`&&` on a range needs **btree_gist**, installed by migration `20260927120000_hotel_foundation`.

**Production verified (2026-09-27):** the VPS runs PostgreSQL **12.22** with btree_gist **1.5**
available, and migrations there connect as the `postgres` superuser (required on PG12, where
btree_gist is not a trusted extension). CI runs HotelOS on `postgres:12-alpine` to match.

The migration fails loudly if the extension cannot be created. If a future environment cannot
install it, the documented fallback is a `room_nights (organization_id, room_id, night)` table with
a `UNIQUE` constraint, written in the same transaction as the allocation — the invariant is never
silently downgraded to an application check.

Concurrent attempts: the losing transaction gets SQLSTATE `23P01`; the booking service maps it to
`409 reservation.room_unavailable` (auto-assignment may retry once on the next free room). A test
that fires concurrent bookings at the same inventory is a Slice 2 acceptance criterion.

## 4. Domain rules locked for later slices *(planned)*

- **Reservation state machine** — `PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT`, plus
  `PENDING|CONFIRMED → CANCELLED` and `CONFIRMED → NO_SHOW`. A pure domain function validates every
  transition; each one writes status history, a Core audit record and an outbox event, in one
  transaction with its side effects.
- **Room state is two stored facts + one derived** — `housekeeping_status`
  (CLEAN/DIRTY/CLEANING/INSPECTED) and `service_status` (IN_SERVICE/MAINTENANCE/OUT_OF_SERVICE)
  are stored; occupancy is derived from reservations. The displayed status is computed with
  precedence `OUT_OF_SERVICE > MAINTENANCE > OCCUPIED > CLEANING > DIRTY > RESERVED > AVAILABLE`.
  There is no single persisted `room.status`, so "the stay ended, so the room is available" can
  never override a maintenance block.
- **Ledger-based money** — `balance = Σ charges − Σ completed payments + Σ refunds`. Labels such
  as Pending / Partial / Paid / Refunded are derived for display; there is no `isPaid`.
- **Payments behind a provider** — `PaymentProvider` with a `SimulatedPaymentProvider` for v1; a
  `PaymobPaymentProvider` can be added without touching the billing domain.
- **Check-in / check-out are application workflows**, not CRUD: check-out orchestrates final
  charges → balance → invoice → transition → room DIRTY → housekeeping task → audit → outbox in one
  transactional boundary.

## 5. Staff application

`hotel-project/app` mirrors `atlas/web`'s structure (`app/`, `config/`, `features/*`,
`components/ui`, `lib/`, `styles/`) with two deliberate differences:

- **HTTP** uses `@auric/web`'s fetch client (`createHttpClient`) directly — Mizan's approach —
  rather than Atlas's axios wrapper around the same refresher. One less dependency, same
  single-flight refresh semantics.
- **Design tokens** are the HotelOS Claude Design values, copied exactly (oklch, hue-75 warm
  neutrals, hue-265 indigo primary, five status tones with soft backgrounds, Plus Jakarta Sans).
  `src/styles/colors.ts` is the only place a color literal may appear; `tokens.css` mirrors it for
  Tailwind's `@theme` and `colors.sync.test.ts` fails on drift (the Atlas rule).

Frontend permission checks (`useAuth().can`, `visibleNav`) are UX only; the backend's
`PermissionGuard` is the security boundary. English-only for v1; all formatting goes through
`src/lib/format.ts` so AURIC localization can be introduced later without hunting call sites.

## 6. Quality gate

Run after every slice; nothing moves forward red.

| Check | Backend (`hotel-project/backend`) | App (`hotel-project/app`) |
|---|---|---|
| Everything but e2e | `npm run ci` (typecheck · lint · format · test · build) | `npm run ci` |
| Integration DB | `hotel_test` (created automatically; migrated from zero per suite) | — |
| End-to-end | — | `npm run e2e` — real backend on `hotel_e2e`, recreated each run, desktop + mobile |

GitHub Actions jobs `hotelos-backend` and `hotelos-app` run the same commands (on PostgreSQL 12).
