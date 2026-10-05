# Raqib — security model and review

The backend is the security boundary. The web app hides what a person may not use, but nothing depends on it.

## 1. Who may do what

- **Identity** is Core's (argon2 passwords, short-lived JWT access tokens, rotating refresh tokens).
- **Authorization** is Raqib's `AccessGuard`: every route declares `@Allow(module, letter)` (or `@Allow()` for routes whose
  service decides), and a route without it is **refused** (fail-closed). A static test (`hardening.integration.test.ts`)
  fails the build if any controller lacks the guard or any route lacks `@Allow`.
- **Permission templates** (`raqib_role_templates`) are per-organization data: letters `V A E S R P D X` per module. Changing
  them is audited, needs a reason and cannot lock the last administrator out.
- **Project scope** comes from dated assignments; services check it per object (`requireProject`) and list endpoints
  filter by it in SQL. A record outside scope answers 403 without saying whether it exists.
- **Object rules** on top of templates: an inspector works only their own visit; nobody reviews, approves or decides their
  own inspection, action or training request; review and approval are separate rights; the responsible person works a
  corrective action and cannot close it.

## 2. Tenant isolation

Every tenant table has `organization_id`, composite foreign keys `(organization_id, id)` and `FORCE ROW LEVEL SECURITY`
with a `tenant_isolation` policy driven by `app.organization_id`, set per transaction by Core. Tests assert RLS is on for
every Raqib table. The runtime database role must not own the tables (see operations.md).

## 3. Historical integrity (enforced in the database)

- published form versions are immutable (trigger);
- the inspection's item snapshot is immutable (trigger);
- visit, action, training and confidential-access histories are append-only (triggers) and carry actor snapshots;
- issued reports are immutable frozen snapshots (trigger) written in the approval transaction;
- overdue is derived from dates and never stored; scores and repeat counts are computed once and stored.

## 4. Evidence and files

Files are private Core files reached only through authorized endpoints (`/raqib/evidence/:id/content`, report PDFs,
confidential attachments), each re-checking scope and writing an audit entry. Core's raw download route is closed to everyone
but the uploader. Uploads are presigned, validated (type, size from the organization's policy, ownership, "landed") before
they are linked.

## 5. Confidential area

Separate tables, separate rule. No role opens it: an active, GM-issued, expiring, revocable grant plus a logged entry with
a stated reason (30-minute session) is required; the GM cannot grant themselves access; the reporter's identity is stored
apart (and not at all for anonymous reports) and opens only through a logged reveal with a reason; the protected log never
names a reporter; a restrictive RLS policy hides the tables from any transaction the application has not authorized;
notifications carry references only; the area is excluded from search, analytics and exports; responses are `no-store`.

## 6. Abuse controls

- **Rate limiting** (per client address for sign-in and the public account request, per verified person for confidential
  submissions, PDF rendering and uploads, generous otherwise); 429 with `Retry-After` detail. Client address honours
  `RAQIB_TRUSTED_PROXY_HOPS`.
- **Response headers**: `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, a `default-src 'none'` CSP,
  HSTS, restrictive `Permissions-Policy`.
- **CSV exports** neutralize spreadsheet formula injection and need the export right.
- **Input** is validated with strict zod schemas (unknown fields rejected); national IDs are masked in lists.

## 7. Review checklist (re-run on every phase)

1. New controller → `@UseGuards(JwtAuthGuard, AccessGuard)` + `@Allow` on every route (the static test enforces this).
2. New tenant table → `organization_id`, composite FKs, `FORCE RLS` + `tenant_isolation`; add it to a migration, not by hand.
3. New list endpoint → filter by project scope in the query, and test a user outside scope.
4. New state change → one transaction: lock row, validate transition and authority, write history + audit + event.
5. New notification → references only, recipients by live permission and scope, never the actor.
6. Anything confidential → separate tables, grant + session, protected log, excluded from search/analytics/exports.

## 8. Known limits

- The rate limiter is in-process memory (one API process per deployment); a multi-process deployment needs a shared store.
- PDFs need Chromium on the server; without it the endpoint answers `raqib.pdf_unavailable`.
- Excel export is CSV (opens in Excel with Arabic intact); a native `.xlsx` writer is not included.
- Video evidence is streamed through the authenticated API (blob), not a time-limited signed storage URL.
