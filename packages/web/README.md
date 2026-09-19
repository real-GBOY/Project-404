# @auric/web

Framework-agnostic web transport shared by every AURIC frontend. Source-only: apps consume it through
a bundler alias (`@auric/web` → `packages/web/src/index.ts`) and a tsconfig `paths` entry.

| Export | Purpose |
| --- | --- |
| `createHttpClient` | fetch client: bearer auth, one retry through a token refresh on 401, non-2xx → `ApiError` |
| `createTokenStore` | in-memory access token + persisted refresh token; safe when storage is unavailable |
| `createRefresher` | single-flight refresh — concurrent 401s share ONE refresh (refresh tokens are single-use; reuse revokes the session) |
| `ApiError` | maps the backend `{ error: { code, message, details } }` envelope |

It knows nothing about any product: no endpoints besides the refresh path you pass in, no claim shape,
no React. Products build their domain API clients on top.

Tests: `npx vitest run packages` from the repo root.
