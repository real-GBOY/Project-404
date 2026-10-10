# Admit — architecture, audit and limitations

Admit sells tickets for events. A guest books, pays the organizer **outside the system** (InstaPay, a wallet, a bank transfer), uploads
proof, a person with the right permission verifies it, tickets with QR codes are issued and emailed, and door staff scan them exactly
once. It is the fifth AURIC product and follows the pattern of the other four: its own folder, its own backend deployment and database,
AURIC Core consumed **by source** (`@core/*`), Core changed by one line only (see below).

```
admit/
  backend/   NestJS on Fastify, @admit/* = backend/app/*, own Prisma project (Core baseline + Admit migrations), own port 3400
  web/       React 19 + Vite + Tailwind 4: customer site (/e, /b, /t), organizer dashboard (/admin), door scanner (/scan)
  worker/    Python email worker: drains the admit_email_messages outbox
  docs/      this file, deployment.md
```

## 1. Audit of AURIC Foundation (what was found, what is reused)

| Capability | State in the repo | Used by Admit |
|---|---|---|
| Identity (login, refresh, argon2) | implemented, tested | **reused as is**: the dashboard and scanner sign in with `/auth/login`; no second auth system |
| Organizations + tenant context (`app.organization_id`) | implemented | **reused**: organizer = organization; every Admit table is tenant-scoped |
| PostgreSQL RLS | `tenant_isolation` policies, `auric_app` (NOBYPASSRLS) / `auric_system` roles | **reused and extended**: FORCE'd RLS on all 13 Admit tenant tables, verified by a test that fails if any table lacks it |
| RBAC | Core roles + `action:resource` permissions, live check per request | **reused**: 22 Admit permissions + 5 roles registered through `seedRbacDefinitions`; `@RequirePermission` on every admin route |
| Files (presigned PUT, local + R2) | implemented | **reused** for payment proof; Admit adds a guest-safe upload route for the local driver only |
| Audit log | `IAuditLogger`, same transaction as the change | **reused**: every state change records `admit.*` |
| Events / outbox | in-process bus + `outbox_messages` polled by a Node worker | **not used for email** (see gap 1); the bus is not needed because every reaction is a row in the same transaction |
| Notifications | in-app + email through nodemailer in-process | **not used**: email is Admit's own outbox + Python worker, as specified |
| Messaging, AI assistant | implemented | not imported (their baseline tables exist, as in every product) |
| Config, validation (zod), errors, logging, health | implemented | reused (`AppError`, `ZodBody`, `readAdmitConfig`) |
| Test conventions | Vitest + real Postgres, `createXTestApp` helpers | followed (`tests/helpers.ts`, `foundation`, `journey`, `demo` suites) |

**Core was changed by one line, and nothing else was.** Cross-origin browsers (the web app on Vercel, the API on a VPS) send a CORS preflight for
the `Idempotency-Key` header that guest checkout uses, and Core's shared CORS setup only allowed `authorization` and `content-type`, so the
booking failed with "could not reach the server" in production (it never showed locally, where the dev proxy is same-origin). `idempotency-key` is
now in the allowed list in `core/http/bootstrap.ts`: a generic, standard header, no Admit knowledge in Core. The other change outside `admit/`
is the `qrcode` dependency (plus its types) added at the repo root, which is where every product's dependencies live; it renders ticket QR PNGs.

### Gaps found in Core, and how each was handled

1. **No cross-process outbox for a non-Node consumer.** Core's outbox is claimed by an in-process Node worker. Admit adds a product-owned
   `admit_email_messages` table (QUEUED → ACCEPTED/DELIVERED, RETRYING, FAILED) that is inserted **in the same transaction** as the change
   that causes the email. The Python worker claims with `FOR UPDATE SKIP LOCKED` under a lease, renders and sends. Core is unchanged.
2. **No Admit permissions or per-event reach in RBAC.** RBAC says what a person may do; it does not say *where*. Admit adds
   `admit_event_staff` (event ↔ person ↔ gate). Anyone without `read_all:event` only ever reaches assigned events, enforced centrally in
   `EventAccess` (every admin service calls it; a foreign event is a 404, not a 403).
3. **Guests have no identity.** Public routes run in the organizer's tenant context via the organization slug (`PublicService.asOrganizer`,
   the HotelOS pattern) so RLS still applies. A booking is reached by `ref + k`, never `ref` alone (see §3).
4. **Organization lookups are invisible to non-members under RLS.** Customer links need the slug while writing as a guest or as the jobs
   runner, so `organizer-directory.ts` reads it on the system connection with a short cache.

## 2. Domain modules (`backend/app/admit/*`)

`events` (venues, events, ticket types, payment methods, `EventAccess`) · `bookings` (guest checkout, magic-link access, cancellation,
expiry, customers) · `payments` (proof upload, review, decisions) · `tickets` (issuance, revocation) · `checkin` (scan, overview, scanner
events) · `emails` (composer, outbox repository, delivery view/retry) · `public` (customer API, rate limiter) · `staff` (event staff,
team & roles) · `reports` · `settings` (organizer profile, `/admit/me`) · `jobs` (hold expiry) · `demo` (opt-in seeder).
`BookingsStoreModule` holds the repositories only, so the feature modules depend on it and not on each other (no cycles).

Dependency direction: product modules → Core contracts/services. Core imports nothing from `admit/`.

## 3. The rules that matter (and where they are enforced)

| Rule | Mechanism | Test |
|---|---|---|
| **Never oversell** | booking locks the requested `admit_ticket_types` rows `FOR UPDATE` (id order, no deadlock), *then* counts held seats from live lines. No stored counter exists to drift | 6 concurrent bookings of 2 remaining seats → exactly 2 succeed |
| **A booking is idempotent** | `Idempotency-Key` header + partial unique index; a replay returns the first booking (200, not 201) | journey |
| **Seats release correctly** | held = `AWAITING_PAYMENT, IN_REVIEW, CONFIRMED`. Expiry/cancel/reject-after-hold free them; `IN_REVIEW` never expires (a slow reviewer must not cost a customer who paid) | journey (expiry, cancel) |
| **Approve once** | `lock booking` → `lock submission` → `UPDATE … WHERE status='SUBMITTED' AND version=$v`; decision idempotency key; loser gets 409 `admit.payment_changed` | 4 concurrent approvals → 1 winner, 2 tickets, 1 email |
| **Issuance is atomic with approval** | tickets, confirmation email row, timeline and audit are written in the approval transaction; `(booking_id, seq)` is unique so issuance is idempotent | journey |
| **QR tokens are never stored or shown** | token = HMAC(`ADMIT_TICKET_KEY`, ticketId), 128 bit; only SHA-256 is stored; staff APIs never include it; the PNG is rendered on demand | journey asserts the token appears in no payload, row or staff response |
| **Check-in is exactly-once** | `UPDATE … WHERE status='VALID' RETURNING`; the loser re-reads and reports `ALREADY_USED` with the first time, gate and staff name | 8 simultaneous scans → 1 ADMITTED |
| **Guests cannot be probed** | `ref` is public and not a credential; the magic-link secret `k` (HMAC of the booking id, hash stored) is required; a wrong ref and a wrong `k` are the same 404; per-IP rate limits (Postgres counters shared by all instances) | journey |
| **Tenant isolation** | RLS on every table + composite (`organization_id`,`id`) FKs; another organizer sees none of it | foundation, journey |
| **A published event stays buyable** | removing or taking off sale the last on-sale ticket type, or deleting/disabling the last enabled payment method of a published event is a 409 (`admit.last_ticket_type`, `admit.last_payment_method`) | crud tests |
| **History is never deleted** | a venue that events use, a ticket type or payment method that bookings used, a published event and any event with bookings cannot be deleted (409); only an unused venue and a bookless draft can. Cancel or archive instead | crud tests |
| **The door flow follows the design** | door staff who sign in at the organizer login go straight to the phone scanner; the first start explains the camera prompt; every verdict is a server answer (approved, already used, not a valid ticket, cancelled, not for this event, event closed, **not paid yet** for a typed booking reference with no tickets); no answer is a connection error that records nothing | journey, e2e |
| **A closed event takes no more money** | a cancelled or archived event refuses new proof uploads (`admit.event_closed`) and refuses approving a payment, so no ticket is issued for it | crud tests |
| **The organizer cannot lock itself out** | an owner cannot remove themselves, and the last `owner` role cannot be removed from the team or the account (409 `admit.cannot_remove_self`, `admit.last_owner`); removing a person drops their roles, event assignments and membership but keeps their account and every audit record | crud tests |
| **Email failure never invalidates a ticket** | the worker writes nowhere but `admit_email_messages`; a FAILED email leaves the booking and tickets untouched | worker tests |
| **The UI shows server state only** | approval shows tickets from the response and the email from the polled record; "emailed" is only drawn once the provider accepted; the scanner shows green only for a server answer (a state machine, tested) | web unit + e2e |

### Booking lifecycle

`AWAITING_PAYMENT` → proof → `IN_REVIEW` → `CONFIRMED` (tickets issued) · reject → back to `AWAITING_PAYMENT` while the hold lasts and the
event allows resubmission, else `REJECTED` · `EXPIRED` (hold lapsed without proof) · `CANCELLED` (guest before payment, or organizer, which
revokes tickets; refused once anyone has entered).

## 4. Email

The API builds the **complete, already-decided payload** (`EmailComposer`): names, dates formatted in the organizer's zone, money, links,
QR image URLs. Seven templates (instructions, proof received, tickets, rejected, expired, cancelled, booking link) live in
`worker/admit_worker/templates`, ported from the approved design. `dedupe_key` (booking, type, occasion) makes a replayed transaction unable
to queue a duplicate. Delivery, leases and backoff are described in `worker/README.md`.

## 5. Web

One bundle for customers; the dashboard and scanner are lazy chunks customers never download. Tokens come from `styles/index.css` (the
design system's colors, Archivo / Instrument Sans / JetBrains Mono, the seven-family status system). Status is always glyph + word + color.
The booking timeline, the review pipeline and the scanner verdicts are derived from server responses, never optimistically.

## 6. Verification performed

- Backend: 68 integration tests against real PostgreSQL (migrate-from-zero, RLS on every table, journey, concurrency, demo). Typecheck, lint, format, build clean.
- Worker: 26 pytest (rendering of all 7 types incl. real API payloads, claim/lease/backoff/final-failure, isolation).
- Web: 31 unit tests (validation, state machines, readiness, date handling, permissions); typecheck, lint, production build clean.
- **Browser end-to-end (Playwright, real Chrome, real backend, throw-away DB)**: a guest books under validation, uploads proof, a reviewer approves, the guest loads real QR PNGs, door staff admit a ticket once and are told when it was first used; a role without the permission cannot reach the review queue; an invalid booking link reveals nothing.
- The Python worker was run against the live dev database and delivered the queued demo mail as `.eml` files.

## 7. Known limitations (honest list)

- **"Delivered" needs provider webhooks.** With SMTP the top status is `ACCEPTED`, as the design's open decision anticipated.
- **Proof files are stored as uploaded** (type and size are enforced; EXIF is not stripped and there is no malware scan, unlike Raqib's ClamAV hook).
- **No cross-booking "My tickets" session.** Guests use the per-booking magic link, and "Find my booking" emails a fresh link (always the same answer).
- **No email invitation or owner-initiated password reset.** The owner creates a new person's account directly (name and a starting password to hand over) or adds an existing account; people change their own password after signing in.
- **Cover images**: the event cover is a URL field in the API; the editor has no upload yet (a striped placeholder shows).
- **Payment methods are per event**, not a shared organizer library; there is no password re-entry step for editing them (they are permissioned and audited).
- **No idle re-auth modal**: sessions follow the Core access/refresh token lifetimes.
- **Single currency (EGP) and time zone (Africa/Cairo)** per the spec's v1 assumptions; English UI, Arabic/RTL is phase 2.
- Partial payments, refund recording, holder-only emails and wallet passes are the spec's open decisions and are not built.
- The camera QR decoding path (BarcodeDetector/jsQR) is covered by unit tests of its state machine and by the camera-blocked path in the browser test; a phone-camera decode was not exercised automatically.
