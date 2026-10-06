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
  submissions, report downloads and uploads, generous otherwise); 429 with `Retry-After` detail. Client address honours
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

## 8. Account security

- **Lock-out.** Wrong passwords (and wrong second-factor codes) are counted per e-mail address in `raqib_auth_throttle`; the
  organization's `security.lockout` setting (default 5 within 15 minutes) locks the address for `RAQIB_LOCKOUT_MINUTES`.
  Unknown addresses are locked the same way, so the answer never reveals whether an account exists. A success clears the count.
- **Second factor.** TOTP (RFC 6238) with ten one-time recovery codes. Secrets are sealed with the data key; a code works once.
  The organization's `security.mfa` setting names the roles that must have it. A person with it enrolled is challenged after the
  password is right. An administrator with the users *edit* right can clear someone's second factor (audited, with a reason).
- **Set-up enforcement.** With `RAQIB_ENFORCE_ACCOUNT_POLICY` on (the default in production), a person whose role requires a second
  factor, or whose password is older than `security.pwRotate` days, can reach only identity and the account-security routes
  (`@SetupRoute`) until done; everything else answers `403 raqib.security_setup_required`.
- **Password rule.** `security.pwLen` is enforced on reset and on change; a change ends every other session.
- **Idle sign-out.** `security.session` minutes of inactivity sign the web app out.
- **Data sealing.** National IDs and second-factor secrets are AES-256-GCM encrypted with keys derived from `RAQIB_DATA_KEY`
  (required in production). Existing plaintext rows are sealed at boot.

## 9. Uploads

Every photo and PDF is read and checked before it becomes evidence: its content must match its declared type, a PDF with scripts or
launch actions is refused, photos are re-stored without GPS and device metadata (orientation is kept), and, when
`RAQIB_CLAMAV_HOST` is set, the file is scanned by ClamAV (an unreachable scanner refuses the upload). The same gate covers
confidential attachments. Videos are checked by type and size only (they are not read into memory). Thumbnails are not generated
server-side (they need native image libraries); the web app previews photos locally.

## 10. Known limits

- The rate limiter is in-process memory (one API process per deployment); a multi-process deployment needs a shared store. The
  scheduled jobs are already safe to run in several processes (a Postgres advisory lock elects one).
- The printable report is built from the frozen snapshot with the evidence photos inlined as data URIs (up to 40 photos of 4 MB each) and contains no scripts; the PDF is made by the person's own browser.
- Video evidence is streamed through the authenticated API (blob), not a time-limited signed storage URL.
- Audit entries are append-only at the database level and are never deleted by the application; the audit retention setting is the
  minimum the organization commits to keep (archival happens outside the app).
- A refresh token lives in the browser's local storage (see `packages/web`); it is protected by the strict CSP and the API's rotation
  and reuse detection, and is revoked on password change.
