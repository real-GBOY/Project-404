# HTTP request files — AURIC Core API

Hand-runnable requests for every route the modular monolith mounts under `/api`.

## How to run them

- **VS Code** — install the [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) extension, open any `.http` file, click **Send Request** above a request.
- **JetBrains IDEs** — open the file in the built-in HTTP client. Pick the `dev` environment from `http-client.env.json`.

Each file is self-contained: the ones that need auth start with a `# @name login` request, and later requests reference `{{login.response.body.tokens.accessToken}}`. Run the login request first (or use "Run all requests in file").

## Start the server first

```
npm run dev          # tsx watch scripts/serve.ts  → http://localhost:3000
```

Needs Postgres running with the `auric` database (see `.env` / `AURIC_DATABASE_URL`).

## The one manual step: email verification

A freshly registered user has status `pending` and **cannot log in until the email is verified**. No SMTP is configured in dev, so the outbox worker's email transport just logs the message. Watch the server console for a line like:

```
INFO (email): email (dev transport — not actually sent)
    to: "you@example.com"
    body: "... http://localhost:3000/verify-email?token=THE_TOKEN_HERE ..."
```

Copy that token into `@verificationToken` in `01-auth.http` and send the "Verify email" request. (The worker polls every 2s, so give it a moment after registering.)

## The other manual step: becoming an admin

RBAC / organizations / audit routes are permission-gated. The very first admin has to be granted directly in the DB — there is no bootstrap endpoint. After registering + verifying a user, grab its id (from the register response or `/me`) and run:

```sql
INSERT INTO user_roles (user_id, role_id)
SELECT '<your-user-id>', id FROM roles WHERE key = 'admin';
```

The route guards check the live RBAC provider, so you do **not** need to log in again — your existing access token works immediately.

## Files

| File | Covers |
|---|---|
| `00-health.http` | `/api/health`, `/api/health/ready` |
| `01-auth.http` | register, verify, login, refresh, `/me`, forgot/reset password, logout |
| `02-rbac.http` | roles, permissions, role assignments |
| `03-organizations.http` | orgs, settings, members |
| `04-files.http` | upload, download, metadata, delete |
| `05-notifications.http` | list, mark read, mark all read |
| `06-audit.http` | query the audit trail |
