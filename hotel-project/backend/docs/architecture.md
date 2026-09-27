# HotelOS — architecture and decisions

HotelOS is the operations platform behind **Hotel Nayel**, the third AURIC product after Mizan
(law firms) and Atlas (real estate). This file records the decisions that shape it and, more
importantly, *why* — so a future change can tell a deliberate constraint from an accident.

Status: **Slices 0–2 complete** (foundation; property setup; the reservation engine — pricing, availability, allocation, lifecycle, calendar). Sections marked *(planned)* describe the locked design
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

## 3. No double booking *(as built — Slice 2)*

The invariant lives in the database, not in the application:

```sql
EXCLUDE USING gist (organization_id WITH =, room_id WITH =, stay WITH &&) WHERE (active)
```

on `hotel_room_allocations`, where `stay` is a `daterange` `[arrival, departure)` (half-open, so a
departure and the next arrival on the same day do not collide). Mixing `=` on a text column with
`&&` on a range needs **btree_gist**, installed by migration `20260927120000_hotel_foundation`.

**Production verified (2026-09-27):** the VPS runs PostgreSQL **12.22** with btree_gist **1.5**
available, and migrations there connect as the `postgres` superuser (required on PG12, where
btree_gist is not a trusted extension). CI runs HotelOS on `postgres:12-alpine` to match.

The migration fails loudly if the extension cannot be created. If a future environment cannot
install it, the documented fallback is a `room_nights (organization_id, room_id, night)` table with
a `UNIQUE` constraint, written in the same transaction as the allocation — the invariant is never
silently downgraded to an application check.

**One ledger for all claims.** `hotel_room_allocations` holds every claim on a room's nights with
a `kind` of `reservation` or `block` (maintenance, from the operations slice). Because both live
under the same exclusion constraint, a booking can never overlap a maintenance block either —
two separate tables could not guarantee that. Releasing a claim (cancel, no-show, the unused nights
of an early check-out) clears `active` in the same transaction as the status change.

**Allocation never checks then writes.** A reservation claims its room by INSERTing an allocation.
The candidate query ("rooms of this type with no overlapping claim") is only a starting point; the
insert decides. Concurrent attempts on the same nights serialise on the constraint: the loser gets
SQLSTATE `23P01`. For a named room that becomes `409 reservation.room_unavailable`. For
auto-assignment each attempt runs inside a SAVEPOINT (a failed statement would otherwise abort the
whole transaction), the next candidate is tried, and candidates are re-read each round so rooms
committed by competitors are seen — `409 reservation.no_availability` is returned only when no
room of the type is actually free.

**Proven by tests** (`app/hotel/tests/reservations.integration.test.ts`): an overlapping allocation
inserted directly in SQL is rejected; 20 simultaneous bookings of one room → exactly 1 wins;
12 simultaneous auto-assigned bookings for 3 rooms → exactly 3 win, on 3 different rooms, with no
orphaned reservations; staggered overlapping ranges racing for one room → zero overlaps. Each test
ends with a self-join over the ledger asserting no two active claims overlap.

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

## 6. Decisions made while building

| Slice | Decision | Why |
|---|---|---|
| 1 | Six hotel roles (owner, manager, receptionist, accountant, housekeeping, maintenance) seeded into Core RBAC; permission keys `action:resource` per module | Reuse Core RBAC; the backend PermissionGuard is the boundary, the app only hides what a role can't use |
| 1 | **The role matrix is read-only** | Core roles are global to a deployment (only assignments are per-tenant). Letting one hotel edit a role would change it for every hotel — a cross-tenant privilege change. Editable roles need per-tenant roles in Core first |
| 1 | Owner-role escalation guard: only `manage:role` may grant/revoke Owner, checked against **live** RBAC, not token claims (which can be up to 15 min stale); no self role change/removal; always ≥ 1 owner | Staff management must not become a privilege-escalation path |
| 1 | Core change: `IdentityModule` exports `IdentityService`, `OrganizationsModule` exports `OrganizationService` | Adding staff needs Core's own register + add-member use cases (with their audit/events); the alternative was a second account path. Two export lines; Core/Mizan (266 tests) and Atlas unaffected |
| 1 | Staff get a manager-issued temporary password; Core's email-verification policy still applies | No second auth flow; onboarding stays inside Core identity |
| 1 | Room housekeeping/service status is **not** editable from the room form | They change only through housekeeping and maintenance workflows (Slice 4) |
| 1 | Guest audit entries record *which fields changed*, not values | Identity-document numbers are personal data; the audit log should not duplicate them. The UI masks document numbers |
| 1 | Guests need a phone **or** an email; email unique per hotel, case-insensitive (partial unique index) | Enforced at API, domain and database |
| 2 | Pricing is a pure function; per night the single highest-priority applicable rule wins (no stacking); strictest `min_nights` of any rule touching the stay applies; discount codes take % off the room total | Explainable prices — every night records the rule that priced it. The request schema has no price field at all |
| 2 | Money arithmetic in integer piastres; totals stored as `numeric(12,2)` with a CHECK that `total = room_total − discount_amount` | No float drift; the database rejects an inconsistent row |
| 2 | Hotel dates are `YYYY-MM-DD` strings end to end; repositories select DATE columns as `::text`; "today" = `Clock` + the hotel's time zone | node-postgres would build a JS Date at local midnight and shift dates across zones |
| 2 | Status history has a `seq` column | Transitions in one transaction share `CURRENT_TIMESTAMP`; `seq` keeps their order |
| 2 | State changes only through explicit actions (`/confirm`, `/cancel`, `/no-show`, `/change-room`, `/change-dates`); each row-locks the reservation first | No generic PATCH can set a status or price; concurrent actions on one booking serialise |
| 2 | No-show only on/after the arrival date; cancel needs its own permission (`cancel:reservation`, not held by receptionists) | Matches the design's role matrix |
| 2 | Core fix: JWT `signAccessToken` now issues `iat`/`exp` from the injected `Clock` (verify already used it) | Core's own rule — no wall-clock time in Core logic. Under any non-real clock fresh tokens were judged expired; Core/Mizan suites (341 tests) pass with the fix |
| 2 | Tests pin `HOTEL_SEED_DEMO=false` | A developer's local `.env` must never change test behaviour |

## 7. Quality gate

Run after every slice; nothing moves forward red.

| Check | Backend (`hotel-project/backend`) | App (`hotel-project/app`) |
|---|---|---|
| Everything but e2e | `npm run ci` (typecheck · lint · format · test · build) | `npm run ci` |
| Integration DB | `hotel_test` (created automatically; migrated from zero per suite) | — |
| End-to-end | — | `npm run e2e` — real backend on `hotel_e2e`, recreated each run, desktop + mobile |

GitHub Actions jobs `hotelos-backend` and `hotelos-app` run the same commands (on PostgreSQL 12).
