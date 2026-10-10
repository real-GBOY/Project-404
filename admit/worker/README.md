# Admit email worker

A small Python service that delivers the transactional email of Admit. It is a **supporting** service: NestJS stays the
only owner of bookings, payment approval, ticket issuance and check-in.

```
 NestJS API ──(same DB transaction as the change)──▶ admit_email_messages (QUEUED, full payload)
                                                          │  FOR UPDATE SKIP LOCKED
                                                          ▼
                                            Python worker: render ▶ send ▶ record outcome
```

## What it does and does not do

- **Does**: claim due rows, render the approved templates from the row's payload, send over SMTP (or write `.eml` files in
  development), record `ACCEPTED` / `RETRYING` / `FAILED`, back off exponentially, give up after `max_attempts` (3).
- **Does not**: approve payments, issue tickets, read bookings, compute totals, or decide who is emailed. Every value in an
  email (names, dates in the organizer's time zone, money, QR image URLs, links) was decided by the API and sits in the
  payload. A payload missing a required field fails the message permanently instead of sending a broken email.
- **A failed email never changes a booking or ticket.** The worker writes nowhere but `admit_email_messages`
  (`test_the_worker_only_ever_writes_the_email_table`). Staff see failures on Email delivery and can Retry them.

## Delivery guarantees

| Concern | How |
|---|---|
| Created transactionally | the API inserts the row in the same transaction as the state change (no email for a rolled-back change, no lost email for a committed one) |
| No duplicates from a replay | `dedupe_key` (booking, type, occasion) is unique per organizer |
| Concurrency safe | claim is one `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`; run as many workers as you like |
| Crash safe | a claim is a lease (`claimed_by`, `claimed_at`); after `ADMIT_WORKER_LEASE_SECONDS` another worker takes the message over |
| Stale worker can't clobber | every settle statement is guarded by `claimed_by = me`; a worker that lost its lease changes nothing |
| Observable | `status`, `attempts`, `last_error`, `provider_message_id`, `sent_at` on every row; surfaced in the admin dashboard |

`ACCEPTED` means the transport accepted the message (SMTP `250`). It is **not** proof of delivery; `DELIVERED` needs provider
webhooks, which plain SMTP does not give (see `docs/architecture.md`).

## Run

```bash
cd admit/worker
python -m venv .venv && .venv/Scripts/pip install -e ".[dev]"      # Windows; use .venv/bin/pip on Linux/macOS
cp .env.example .env                                               # set ADMIT_WORKER_DATABASE_URL
.venv/Scripts/python -m admit_worker                               # runs until Ctrl-C / SIGTERM
```

With `ADMIT_WORKER_TRANSPORT=log` (the default) messages land in `./outbox/*.eml`, which is also how the demo is checked.

## Tests

```bash
.venv/Scripts/python -m pytest
```

Rendering tests are self-contained. Worker tests (claiming, leases, backoff, final failure, isolation) run against the
throwaway `admit_test` database that `npm test` in `admit/backend` migrates; they skip themselves if it is not there.
`test_real_payloads_from_the_api_render` renders whatever the NestJS composer queued during its own integration tests, so the
API ↔ worker payload contract is checked from both sides.

## Templates

`admit_worker/templates/` — one base layout (header, status pill, footer) and a macro file shared by seven emails:
`instructions` (E0), `proof-received` (E1), `ticket-confirmed` (E2, the only one with tickets), `rejected` (E3),
`expired` / `cancelled` (E4), `magic-link`. Markup follows the approved design (`email/ticket-confirmed.html`): 600 px,
table-based, inline-styled, system fonts, tickets on a fixed white surface so the QR survives dark mode, Outlook VML button.

## Inline QR images

For TICKETS emails the worker downloads each ticket's QR PNG (`ticket_qr_code_url`) at send time and attaches it as an inline `cid:` image
(multipart/related), so the code shows without "display images". A failed or oversize download keeps the remote link and never holds the email
back (`admit_worker/images.py`).
