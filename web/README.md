# `web/` — Mizan Web

> The web client of **Mizan** (Project #1), the law-firm application built on
> AURIC Core. This is **product code**, not platform code. It talks to the
> backend over HTTP only.

`PLAN.md` is *what to build and in what order*. `ARCHITECTURE.md` is *how the
code is organised*. This README is the **architectural contract**: what `web/`
is, what it may and may not depend on, and where the Core ↔ Mizan boundary sits
on the frontend.

---

## 1. What it is

A standalone Vite + React 19 + TypeScript SPA (its own `package.json`, sibling to
`core/` and `app/`, **not** an npm workspace). Tailwind v4 semantic tokens,
Radix primitives restyled to the Mizan design language, TanStack Query for server
state, React Router v7, react-hook-form + Zod, i18next (AR default + RTL), MSW
for the mock layer.

## 2. Why it exists

Mizan needs a production-quality, permission-aware, Arabic-first web UI over the
Mizan/AURIC API. A web client is not a platform capability — every product has
its own UX — so it lives with the product, not in Core.

## 3. What problem it solves

- An opinionated law-firm product surface (16 screens: dashboard, clients,
  matters, hearings, tasks, documents, calendar, billing, team, notifications,
  settings, Ask Mizan) — not a generic ERP shell.
- A frontend that is **API-ready**: every call targets a real backend route;
  MSW intercepts in dev/test and is deleted per feature as backend phases land.
- Permission-aware UI driven by the exact keys `/api/me` returns.

## 4. Responsibilities

- Render and operate the Mizan product screens.
- Own the session lifecycle on the client: login → org selection → token in
  memory, refresh token in `localStorage`, silent refresh on `401`.
- `can("action:resource")` gating of nav, actions, and routes — **UX only**.
- AR/EN + RTL, per-currency money display (never summed), the five route states
  (loading / empty / error / 403 / 404).
- The mock API layer (`src/mocks/`) until the real backend is reachable.

## 5. What it owns

- The Mizan design system (`src/components/ui/*` — ~28 primitives) and product UI.
- Client-side session/tenant/permission derivation (`src/lib/{auth,tenant,permissions}`).
- Product copy (`src/lib/i18n/resources/*.json`).
- The frozen API **contract types** it codes against (`src/features/<f>/types`,
  `src/types`) — mirrors of the backend response shapes, not database entities.
- The dev mock dataset (`src/mocks/fixtures/db.ts`) and handlers.

## 6. What it explicitly does NOT own / must not do

- **Import any repo code.** `web/` never imports from `core/` or `app/` —
  `grep -rn "\.\./\.\./core" web/src` is empty. It consumes the **HTTP API
  only**. (It re-implements the permission matcher and the `ar-EG` formatters to
  match Core's — it does not import them.)
- **Security.** Frontend `can()` and hidden buttons are UX. The backend is the
  authority (Plan §47 rule 11). A hidden button is not a protected endpoint.
- **Business rules / calculations.** Invoice totals, overdue derivation, VAT —
  displayed from the API, computed server-side (Mizan decisions #9, #8).
- **Generic abstractions.** No `GenericERPClientPage`,
  `UniversalBusinessDashboard`, form/entity/workflow engines. Reuse *primitives*
  and *patterns*, not imagined frameworks (Plan §49).
- **A backend of its own.** Same API as the future mobile client.

## 7. Public interfaces it consumes (the boundary)

`web/` depends on the **Mizan/AURIC HTTP API** and nothing else:

| Concern | Endpoints (real) |
|---|---|
| Auth / session | `POST /api/auth/{login,refresh,logout,password/*,email/*}`, `GET /api/me` |
| Permissions | the `perms` claim in the access token + `GET /api/me`.`permissions` |
| Tenant | the `org` claim; `POST /api/auth/refresh { organizationId }` to switch |
| Notifications | `GET /api/notifications`, `POST /api/notifications/{:id/read,read-all}` |
| RBAC / audit | `GET /api/rbac/*`, `GET /api/audit-logs` |
| Files | `POST /api/files`, `GET /api/files/:id` |
| Law-firm domain | `GET/POST /api/{clients,matters,hearings,tasks,documents,invoices,payments,expenses,team,dashboard,calendar,lawfirm/settings}` and their sub-routes (frozen contracts, MSW-mocked until each backend phase ships) |

Internal layering (enforced by review): `app/ → features/ → components/ + lib/`.
Only `lib/api/*` and `mocks/*` know URLs or call `fetch`. A feature never imports
another feature. See `ARCHITECTURE.md`.

## 8. How it is used / run

```bash
cd web
npm install
npm run dev            # http://localhost:4300, MSW on
# sign in: any email + any password ≥ 10 characters
```

Point at a real backend: `VITE_API_MOCKS=off` (Vite proxies `/api` →
`http://localhost:3000`). Per-feature cutover = delete `src/mocks/handlers/<f>.ts`
and its entry in `handlers/index.ts`; the feature's `api/` already targets the
real route.

## 9. Dependencies & direction

```
AURIC Core  ◀──  Mizan backend (app/lawfirm)  ◀──  web/  (this)   [◀── mobile/ later]
```

`web/` is downstream of everything. Nothing depends on `web/`. It reaches the
system only through the application API.

## 10. Invariants

1. No import from `core/` or `app/` — HTTP API only.
2. Permission keys are exactly what `/api/me` returns (`action:resource`).
3. Frontend authz is UX; the backend enforces.
4. Money is `{ currency, amount }[]`, rendered as stacked lines, never summed; no
   FX.
5. AR is the default language; RTL is first-class (logical CSS utilities only).
6. Server state lives in TanStack Query; URL owns filters/tab/pagination; no
   global store.
7. Components never call `fetch` or import mock data; API goes through
   `feature/api → lib/api/http-client`.
8. Design-system primitives are infrastructure; the product UI built from them
   stays opinionated.

## 11. Example — a permission-gated action

```tsx
// keys come straight from /api/me — never a role-name check
{can("void:invoice") && inv.status !== "paid" && (
  <Button onClick={() => setConfirm("void")}>Void</Button>
)}
```

The backend re-checks `void:invoice` on `POST /api/invoices/:id/void` regardless.

## 12. Testing expectations

Vitest + Testing Library (component, hook, page-state, permission-state) + a few
MSW-backed integration smokes (login → shell; multi-org → selector). Every
feature: `typecheck` + `lint` + `build` + tests green; AR/RTL check; the five
states; permission sweep with a low-permission session. Playwright e2e is a
later addition. Test-infra notes live in `src/test/` and the project memory.

## 13. When this should NOT be reused or extended

- Do **not** extract `web/src/features/*` into a shared "AURIC web" package. It
  is Mizan's product UI. Reuse across real future clients is a rule-of-three
  concern (Plan §40–43), and even then only *primitives* and *patterns* move,
  never DOM components shared with React Native.
- Do not add a plugin system, a module marketplace, or a generic workflow/form
  engine (Plan §49) — future possibilities, not current requirements.
- Do not grow `components/ui/` speculatively; a pattern becomes a shared
  primitive because it is actually reused, not because it might be.
