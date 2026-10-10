# Admit: event ticketing with manual payment verification

| [Overview](../../README.md) | [Mizan](mizan.md) | [Atlas](atlas.md) | [HotelOS](hotelos.md) | [Raqib](raqib.md) | **Admit** | [Security](../../SECURITY.md) |
|:---:|:---:|:---:|:---:|:---:|:---:|:---:|

Admit sells tickets for events where people **pay the organizer directly** (InstaPay, a mobile wallet, a bank transfer) instead of paying a
card processor. A guest books without an account, transfers the exact amount, uploads a screenshot as proof, and a person with the right
permission checks it against the organizer's account. Approval issues one QR ticket per seat and emails it. At the door, staff scan each
ticket, which admits it exactly once. It's the fifth product on Project-404 Core, built from an approved design (customer flow, organizer
dashboard, door scanner, seven emails).

**Live demo:** [admit-web-lime.vercel.app](https://admit-web-lime.vercel.app) (sign in at `/admin` with any account from the demo list below;
the API runs on the Raqib VPS, proofs go to Cloudflare R2). How it is deployed: [docs/admit-deployment.md](../admit-deployment.md).

![Admit organizer overview](../screenshots/admit/dashboard.png)

---

## Screenshots

| | |
|---|---|
| **Customer site:** upcoming events, categories, a featured event ![Home](../screenshots/admit/customer-home.png) | **Event page:** ticket types, live availability, one-tap quantity ![Event](../screenshots/admit/customer-event.png) |
| **Payment review:** the proof next to the expected amount, four checks, approve or reject ![Review](../screenshots/admit/review.png) | **Bookings:** every booking with its timeline, tickets and emails ![Bookings](../screenshots/admit/bookings.png) |
| **Events:** drafts, published, readiness checklist before publishing ![Events](../screenshots/admit/events.png) | **Tickets:** issued tickets, check-in state, revoke ![Tickets](../screenshots/admit/tickets.png) |
| **Check-in:** gate numbers, scans and the attempts log ![Check-in](../screenshots/admit/checkin.png) | **Customers:** who booked what, across events ![Customers](../screenshots/admit/customers.png) |
| **Reports:** verified revenue, sales by event and ticket type ![Reports](../screenshots/admit/reports.png) | **Email delivery:** every message and its status, retry for failures ![Email](../screenshots/admit/email.png) |
| **Settings:** organizer profile, team and roles ![Settings](../screenshots/admit/settings.png) | **Door scanner:** the phone view door staff use ![Scanner](../screenshots/admit/scanner.png) |

All data shown is synthetic demo data.

## Who uses it

| Role | What they do |
|---|---|
| **Guest** | Books without an account, pays outside the system, uploads proof, reaches the booking and the tickets through an unguessable link |
| **Owner** | Everything, including the team and the organizer's settings |
| **Event manager** | Creates and publishes events, ticket types and payment methods; cancels bookings |
| **Finance reviewer** | Reviews payment proofs for the events they are assigned and approves or rejects them |
| **Door staff** | Scans tickets at the events and gates they are assigned (the scanner only) |
| **Viewer** | Reads the dashboard and reports |

22 permissions in all, checked live on every request. People below an owner reach only the events they are assigned to.

## Lifecycle

`AWAITING_PAYMENT` (the seats are held, 24 hours) → the guest uploads proof → `IN_REVIEW` → `CONFIRMED` (tickets issued, email queued). A rejection
returns the booking to `AWAITING_PAYMENT` while the hold lasts, otherwise it ends `REJECTED`. A hold that lapses without proof is `EXPIRED`; a
guest can `CANCEL` before paying and the organizer can cancel any time before anyone has entered. A booking in review never expires, because
a slow reviewer must not cost a customer who already paid.

## Highlights

| | |
|---|---|
| **Never oversells** | A booking locks the ticket types in id order, then counts held seats from live bookings. There is no stored counter to drift. A test books the last 2 seats 6 times at once and exactly 2 succeed. |
| **Approve once** | Version-checked decisions: four reviewers approving the same payment at once produce one winner, two tickets and one email. |
| **Exactly-once check-in** | One atomic `UPDATE ... WHERE status = 'VALID'`. Eight simultaneous scans admit once; the rest are told when, where and by whom the first one happened. |
| **Secrets that are not stored** | The QR token is an HMAC of the ticket id under a server key; only its SHA-256 is stored and staff APIs never return it. Booking links use a separate derived secret, and a wrong reference and a wrong link answer identically. |
| **Scanning with any phone** | A ticket's QR holds the organizer's picture URL followed by `#<token>`: a camera app opens the picture, the door scanner reads the token from the fragment. |
| **A real email pipeline** | The API writes the complete, already-decided email into an outbox table in the same transaction as the change. A **Python worker** claims rows with `FOR UPDATE SKIP LOCKED`, renders seven templates and sends over SMTP with leases and backoff. A failed email never invalidates a ticket. |
| **Honest interface** | The scanner shows green only for a server answer (a tested state machine); "emailed" is drawn only once the provider accepted the message. |
| **Tenant isolation** | The organizer is a Core organization; every Admit table has forced row-level security, and public guest routes run inside the organizer's tenant context. |
| **Run by a real organizer** | `npm run provision` onboards an organizer with no demo data; owners create staff accounts, reset passwords and remove people; everyone changes their own password; bookings and attendees export as spreadsheet-safe CSV; every approval, cancellation, export and team change is in an owner-readable audit log; a booking's tickets email can be sent again. See [the go-live guide](../../admit/docs/go-live.md). |
| **Looked after** | nightly database backups copied off the machine into R2 and verified; security headers, request limits on sign-in and checkout, fail2ban; CI on every push (backend, web, worker, browser). |
| **The numbers** | 13 tenant tables · 22 permissions · 5 roles · 77 backend tests, 28 worker tests, 31 web tests and 13 browser tests in real Chrome. |

## How it's built

```
admit/
  backend/   NestJS on Fastify, Core by source (@core/*), @admit/* = backend/app/*, own Prisma project and migrations, port 3400, database admit
  web/       React 19 + Vite + Tailwind 4: customer site (/e, /b, /t), organizer dashboard (/admin), door scanner (/scan)
  worker/    Python 3.12: drains the admit_email_messages outbox (psycopg + Jinja2)
```

Modules (`backend/app/admit/`): events, bookings, payments, tickets, checkin, emails, public, staff, reports, settings, jobs, demo. Core never imports
Admit (its only change for Admit is one generic CORS header, `idempotency-key`). The audit of what Core provided, the gaps found and how each was handled is in
[admit/docs/architecture.md](../../admit/docs/architecture.md).

## Run it locally

```bash
createdb admit
cd admit/backend && cp .env.example .env     # set ADMIT_SEED_DEMO=true
npm run serve                                # migrates, seeds, serves http://localhost:3400
cd ../web && npm install && npm run dev      # http://localhost:4700
cd ../worker && python -m venv .venv && .venv/bin/pip install -e ".[dev]"
ADMIT_WORKER_DATABASE_URL=postgres://postgres:postgres@localhost:5432/admit .venv/bin/python -m admit_worker   # writes ./outbox/*.eml
```

## Demo accounts

Organizer **Nile Sessions Events** at `/e/nile-sessions`. Sign in at `/admin` (door staff at `/scan`); every account uses `demo-password-2026`.

| Account | Role |
|---|---|
| `salma@nilesessions.example` | Owner |
| `dalia@nilesessions.example` | Event manager |
| `karim@nilesessions.example` | Finance reviewer |
| `ali@nilesessions.example` | Door staff |
| `mona@nilesessions.example` | Viewer |

## Tests

```bash
cd admit/backend && npm run ci                # typecheck, lint, format, 77 integration tests on real PostgreSQL, build
cd admit/web && npm test && npm run e2e       # 31 unit tests; the browser journey (needs Chrome)
cd admit/worker && .venv/bin/python -m pytest # 28 tests
```

The browser journey runs a guest booking, the upload, the reviewer's approval, the real QR images and the door scan in real Chrome against a
throwaway database. SCREENS=1 re-captures the screenshots on this page.

## Known limitations

- "Delivered" needs provider webhooks, so the top email status is `ACCEPTED`. The live deployment sends through a Gmail account (a demo-grade sender).
- Proof files are stored as uploaded: type and size are enforced, but there is no metadata stripping or malware scan.
- No cross-booking "My tickets" session: guests use the per-booking link, and "Find my booking" emails a fresh one.
- There is no email invitation and no self-service "forgot password": an owner creates a new person's account (name and a starting password they hand over), adds an existing one, and resets passwords.
- Single currency (EGP) and time zone (Africa/Cairo), English only; Arabic/RTL is phase two.
- Partial payments, refund recording, holder-only emails and wallet passes are open decisions in the spec and are not built.

## More

| | |
|---|---|
| [admit/README.md](../../admit/README.md) | Start here: what is in the folder, how to run, test |
| [admit/docs/architecture.md](../../admit/docs/architecture.md) | Audit of Core, the rules that matter and where each is enforced, limitations |
| [admit/docs/go-live.md](../../admit/docs/go-live.md) | Going live with a real organizer: onboarding, secrets, email, refunds, personal data, rehearsal |
| [docs/admit-deployment.md](../admit-deployment.md) | How Admit is deployed: VPS, nginx, TLS, worker, Vercel, backups |
