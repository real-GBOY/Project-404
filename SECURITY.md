# Security

| [Overview](README.md) | [Mizan](docs/products/mizan.md) | [Atlas](docs/products/atlas.md) | [HotelOS](docs/products/hotelos.md) | **Security** |
|:---:|:---:|:---:|:---:|:---:|

This page explains how Project-404 keeps each customer's data separate and safe, and how to report a
vulnerability. Every control below lives in Core, so all three products get it without writing it again.

The rule behind all of it: **the server enforces every permission.** Hiding a button in the UI is never the
only control.

---

## Reporting a vulnerability

Please **don't open a public issue** for a security problem. Report it privately through GitHub: open the
repository's **Security** tab and choose **Report a vulnerability**. Include the product, the steps to
reproduce it and what an attacker could gain.

Only the `main` branch is supported. Fixes are made there and deployed from it.

---

## Defense in layers

```
 request ──► 1. who are you?     JWT access token (15 min), rotating refresh token
         ──► 2. may you?         permission guard: action:resource, checked on the server
         ──► 3. is it valid?     Zod schema on every body and query
         ──► 4. whose data?      PostgreSQL row-level security on every tenant table
         ──► 5. what happened?   append-only audit trail, immutable in the database
```

A bug in one layer doesn't open the others. If a query forgets its tenant filter, row-level security still
returns nothing from other tenants. If the UI shows a button it shouldn't, the permission guard still refuses
the request.

## 1. Identity and sessions

- **Passwords** are hashed with **Argon2id** and rehashed automatically when the parameters get stronger.
- **Sign-in doesn't reveal which emails exist.** An unknown email still spends time hashing, so response time
  doesn't give it away.
- **Short-lived access tokens** (15 minutes by default) and **refresh tokens** (30 days) that **rotate on
  every use**. Refresh tokens are stored only as hashes.
- **Stolen-token detection.** If an already-used refresh token is presented again, every session for that
  user is revoked.
- **Email verification** links expire after 24 hours and **password reset** links after 1 hour.

## 2. Permissions

- Code checks **permissions** (`action:resource`, like `read:matter` or `refund:payment`), never role names.
  Roles are just bundles of permissions.
- Every endpoint declares its permission, and `PermissionGuard` enforces it before the use case runs.
- **Escalation-sensitive actions**, like granting the Owner role or supervising maintenance, are checked
  against the user's live permissions, not the claims in their token.
- The frontend's `can()` only decides what to show. It's never the security check.

## 3. Validation

- Every request body and query goes through a **Zod schema** before any business logic runs. Unknown or
  malformed input is rejected with a 400.
- Clients can't choose their own tenant or identity. The organization and user always come from the signed
  token, never from the request body.

## 4. Tenant isolation (multi-tenancy)

An organization is the tenant. All tenants share one schema, and the database keeps them apart:

- Every tenant table has `organization_id NOT NULL` and a **row-level security** policy.
- Each transaction sets its tenant with `SET LOCAL app.organization_id`, so the setting can't leak into
  another request's connection.
- The application connects as `auric_app`, a role that **can't bypass** row-level security (`NOBYPASSRLS`
  with `FORCE ROW LEVEL SECURITY`). Only system work, like migrations and background workers, uses the
  separate `auric_system` role.
- Child tables use **composite foreign keys** that include the tenant, so a row can't point at another
  tenant's data.
- Each product has **its own database**. A bug in Atlas can't reach Mizan's or HotelOS's data.

The tests run as the restricted role on purpose. They prove tenant A can't read tenant B even when the
application code gets a query wrong. Details: [docs/tenancy.md](docs/tenancy.md).

## 5. Money and payments

- Prices, totals, balances and refunds are **computed on the server**. The client never sends a total the
  server trusts.
- Amounts use **integer arithmetic**, and different currencies are never added together.
- Payments, refunds and public bookings carry an **idempotency key**, so a retried request can't charge,
  refund or book twice.
- Balances come from a **ledger** of charges, payments and refunds, not from a flag that could drift.

## 6. Public endpoints

HotelOS's public booking API is the only endpoint anonymous visitors can call:

- It's **rate-limited per client address and hotel**, with counters stored in PostgreSQL so every server
  instance shares them.
- It trusts `X-Forwarded-For` only for the configured number of proxy hops (`HOTEL_TRUSTED_PROXY_HOPS`), so
  clients can't spoof their address.
- It requires an `Idempotency-Key`, and it can only read the few hotel settings a guest needs.

## 7. Files

- Uploads use **presigned URLs** (local disk or Cloudflare R2): the browser uploads directly to storage and the
  server confirms the upload afterwards.
- Uploads have a **size limit** (25 MB by default).
- **Downloads are permission-checked** on every request, and files belong to a tenant like everything else.

## 8. Audit trail

- Core records **who did what, when and to which record** for every important action.
- The trail is **append-only**: a database trigger blocks every `UPDATE` and `DELETE` on it, so not even
  application code can rewrite history.
- HotelOS shows the trail as a readable activity feed, and Mizan audits every AI assistant turn.

## 9. AI assistants

Mizan and Atlas have AI copilots built on `core/assistant`. The model is **never** the security boundary:

- **Tools run as the signed-in user.** The AI can only read or change what that user could, and every tool
  call is checked again against permissions and tenant, whatever the model asked for.
- **There's no generic query tool.** The model can't run SQL or reach the database directly, only call named
  use cases.
- **Prompt injection.** Text inside records (like a note saying "ignore your instructions") is passed to the
  model as data, not instructions. Even if the model follows it, the next tool call is still
  permission-checked and refused. Document bodies are never sent to the model.
- **Defense in depth.** Responses that look like credentials are redacted, and API keys never appear in
  prompts, tool results, logs or audit rows.
- Atlas has 33 dedicated AI security tests: cross-tenant reads, denied roles, injection payloads and
  tampered request bodies.

Details: [docs/assistant.md](docs/assistant.md) · [docs/atlas-assistant.md](docs/atlas-assistant.md).

## 10. Secrets and deployment

- `.env` files are git-ignored. Production secrets live only on the server, never in the repository.
- APIs are served over **HTTPS** (Let's Encrypt), and cross-origin requests are allowed only from configured
  origins (`AURIC_CORS_ORIGINS`).
- Health checks (`/health`, `/health/ready`) reveal no data.

---

## Known gaps

Open items, listed honestly:

- **Sign-in isn't rate-limited yet.** Only HotelOS's public booking API has rate limiting. Login throttling
  is the next hardening step.
- **Roles are global per deployment.** A tenant can't define its own custom roles yet.
- **CI runs on demand**, not on every push, so security tests aren't run automatically on every change.
- **HotelOS payments are simulated.** No real card data is handled anywhere in the system today.
