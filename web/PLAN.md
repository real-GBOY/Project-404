# Mizan Frontend — Implementation Plan

> **Product:** Mizan — a law-firm management system for Tawfik & Partners,
> **powered by** AURIC Core. This is Project #1, the first real client
> application on the AURIC Foundation.
>
> It is **not** "AURIC ERP", not a generic multi-industry dashboard, not the
> AURIC Core frontend. Build an opinionated law-firm product.

---

## 0. Architectural invariant

```
AURIC Core (backend)
      ▲
      │  HTTP API only — contracts, capabilities
      │
   Mizan
      ├── backend domain   app/lawfirm/*   (Phases 1.1–1.9 — mostly unbuilt)
      └── frontend         web/            (this plan)

within web/:
   app/routes ──▶ features/* ──▶ components/* (shared UI) ──▶ lib/* (primitives)
   dependencies flow toward stable primitives; no circular deps between features
```

- `web/` depends on **nothing** in the repo — only the backend HTTP API. It
  never imports `core/` or `app/` code (mirrors `core/ ──X──▶ app/`).
- Mizan-specific domain logic stays inside its `features/` module.
- A UI pattern becomes a shared `components/` primitive **because it is actually
  reused**, not speculatively. No `GenericERPTable`, no `IndustryDashboard`.
- Domain reuse across *real* future client projects is a later concern
  (rule of three) — do not reverse that process.

---

## 0.1 Progress

**F0–F16 built** (2026-09). Every screen in §8 is live against the MSW mock layer
(`src/mocks/` — one shared dataset in `fixtures/db.ts`; auth/notifications/rbac/
audit wired to the same shim). Real backend cutover = delete the feature's
handler file. Gate on every phase: `typecheck` + `lint` + `build` + `test` green
(~78 tests). Feature routes are code-split. Tests run on Vitest `forks` pool;
Radix-Popper overlays are driven synchronously (see `src/test/`).

## 1. Current state (inspected)

- **No frontend exists.** Backend-only repo (NestJS/Fastify, ESM). Greenfield —
  no rewrite risk.
- **Backend endpoints live today** (wire these for real now):
  - `POST /api/auth/{register,login,refresh,logout,logout-all}`,
    `/api/auth/{password/forgot,password/reset,email/verify,email/resend}`
  - `GET /api/me`
  - `GET /api/notifications`, `POST /api/notifications/{:id/read,read-all}`
  - `GET /api/rbac/roles`, `POST /api/rbac/assignments`, `GET /api/rbac/users/:id`, …
  - `GET /api/audit-logs`
  - `GET/POST /api/organizations/:id/members` (partial)
  - `POST /api/files`, `GET /api/files/:id[/metadata]`, `DELETE /api/files/:id`
  - `GET /api/health`, `/api/health/ready`
- **Not built** — every law-firm domain endpoint (clients, matters, hearings,
  tasks, documents, billing, staff, dashboard, lawfirm settings). Contracts are
  frozen from the backend Part-1 assessment and mocked (see §5).
- **Design** — one `.dc.html` on a bespoke `sc-if/sc-for` runtime (`support.js`).
  Not reusable as code. 16 screens + full data model extracted. The prototype has
  **no** login, org-select, create/edit forms, or loading/empty/error/404
  states — those are gaps, built fresh in the Mizan visual language (§29:
  smallest reasonable assumption).

---

## 2. Stack

| Concern | Choice | Why |
|---|---|---|
| Framework | **Vite + React 19 + TypeScript** | SPA against the API; fast dev loop |
| Styling | **Tailwind v4** + semantic `@theme` token layer | tokens, no arbitrary values (§12) |
| Primitives | **Radix UI** (shadcn generator as seed), **fully restyled to Mizan** | a11y / focus / keyboard for free (§23); not stock shadcn (§31) |
| Server state | **TanStack Query** | caching + loading/error/mutation states (§22, §25) |
| Routing | **React Router v7** (data routers, lazy) | conservative, route-level error/loading |
| Forms | **react-hook-form + Zod** | field errors, dirty guard, schemas (§21) |
| Mock layer | **MSW** (dev + tests) | network-level; components never see mocks (§6) |
| i18n | **i18next**, AR + EN, **AR default + RTL** | AURIC localization mandate; RTL retrofit is expensive |
| Icons | Material Symbols Rounded via `<Icon>` | matches the design |
| Tests | Vitest + React Testing Library; Playwright (~4 e2e smokes) | §28 Step 5 |
| Lint/format | ESLint (typescript-eslint, jsx-a11y, react-hooks) + Prettier | |

**No** Redux/Zustand (§25). Server state → Query; auth/org/permissions → React
context; UI/form state → `useState` / RHF.

`web/` is a **standalone package** (its own `package.json`), sibling to `core/`
and `app/`. Not an npm workspace — the root `package.json` stays Core's.
`cd web && npm run dev`.

---

## 3. Directory structure

Aligned to `docs/system-architecture.md` §18.

```
web/
├── package.json  vite.config.ts  tsconfig*.json  index.html  eslint.config.js  (Tailwind v4 via @theme)
└── src/
    ├── app/
    │   ├── providers/           QueryClient · I18n · Router · Auth · Tenant · Tooltip · Toaster · ErrorBoundary
    │   ├── router/              route tree (lazy per feature) + ProtectedRoute + RequirePermission
    │   ├── layouts/             AppShell (246px sidebar + 64px topbar) · AuthLayout
    │   └── main.tsx
    ├── features/
    │   ├── auth/  dashboard/  clients/  matters/  hearings/  tasks/
    │   ├── documents/  calendar/  billing/  staff/  settings/  notifications/  assistant/
    │   └── <feature>/           pages/  components/  hooks/  api/  schemas/  types/  index.ts
    ├── components/
    │   ├── ui/                  design-system primitives (see §4)
    │   ├── forms/               FormField · form layout · field wrappers
    │   ├── tables/              DataTable · Pagination · column helpers
    │   ├── feedback/            Skeleton · EmptyState · ErrorState · ForbiddenState · NotFoundState · Toaster
    │   └── navigation/          SidebarNav · TopBar · Breadcrumb · CommandMenu
    ├── lib/
    │   ├── api/                 httpClient (fetch + bearer + 401→refresh) · ApiError · queryClient
    │   ├── auth/                AuthProvider · useAuth · tokenStore · authEvents
    │   ├── permissions/         can() · <Can> · usePermissions
    │   ├── tenant/              TenantProvider · useOrganization · <OrgSwitcher>
    │   ├── i18n/                i18next init · ar.json · en.json · useDir()
    │   └── format/              money (per-currency) · date (Intl ar-EG/en-EG, Africa/Cairo) · number
    ├── hooks/                   cross-feature hooks (useUrlParams, useMediaQuery, …)
    ├── mocks/                   browser.ts · server.ts · handlers/<feature>.ts · fixtures/ (dev/test only)
    ├── types/                   shared API contract types mirroring the backend plan
    ├── styles/                  tokens.css · globals.css
    └── test/                    setup.ts
```

`web/src/app/` (routing/composition) is distinct from the repo's `app/`
(backend domain) — different roots, no collision. `web/` imports no repo code.

---

## 4. Design system

### Tokens (extracted from the design)

```
bg.app       #F6F6F8      bg.surface   #FFFFFF     bg.subtle  #FAFAFC / #F7F7FA
bg.sand      #F1E8D9  (selected/active)   bg.sand-hover #EDE3DB   bg.warm #FCFAF6
fg           #16161D      fg.body      #33333F     fg.muted   #8A8AA0     fg.subtle #9A9AB0
primary      #3B2418      primary.hover #2E1A12    primary.fg #FFFFFF     link #4A2D1F
border       #ECECF1      border.control #E5E5EC   divider    #F2F2F6     border.accent #D1BBA8
tone.success #E7F7EF / #067647     tone.warning #FEF4E4 / #B54708
tone.danger  #FEECEB / #B42318     tone.info    #E8F1FF / #175CD3
tone.neutral #F2F3F5 / #4A4A5C     tone.brand   #F1E8D9 / #4A2D1F     tone.teal #E4F6F6 / #0E6E6E
radius       sm 8 · md 10 · lg 14 · xl 20 · pill 999
font         'Plus Jakarta Sans' 400–800 ; headings letter-spacing -0.02em
shadow.pop   0 1px 2px rgba(22,22,29,.08)      shadow.sheet 0 24px 60px rgba(22,22,29,.24)
layout       sidebar 246 · topbar 64 · content-pad 24/26 · desktop min-width ~1180
```

Semantic names only (`background`, `foreground`, `muted`, `border`, `primary`,
`destructive`, `success`, `warning`). **No dark mode** — not in the design;
tokens are light-only but structured so a dark set can be added later.

### Primitives (~25, Radix-based, Mizan-styled)

`Button` · `IconButton` · `Input` · `Textarea` · `Select` · `Combobox` ·
`Checkbox` · `RadioGroup` · `Switch` · `DatePicker` · `Dialog` · `Sheet` ·
`DropdownMenu` · `Tabs` · `SegmentedControl` (table/grid, Month/Week/Agenda) ·
`Badge` (tone set) · `Card` · `StatCard` · `Avatar` · `DataTable`
(sort · paginate · row-click · table+grid toggle) · `Pagination` · `Tooltip` ·
`Toast` · `Skeleton` · `EmptyState` · `ErrorState` · `Breadcrumb` ·
`SearchInput` · `CommandMenu` (⌘K global search) · `FormField` · `ConfirmDialog`.

Every primitive: AR/RTL-safe (logical CSS), keyboard-accessible, with
loading/disabled variants where relevant.

---

## 5. API layer & mock strategy

```
Component → feature hook (useQuery/useMutation) → feature api/ (typed fns) → lib/api httpClient → HTTP
```

- Components never call `fetch`. Never import mock data. (§6, §26)
- Each `features/<f>/api/` exports typed functions hitting the **real planned
  route**. `features/<f>/types/` + `features/<f>/schemas/` define the contract
  (mirrors the backend Part-1 assessment).
- **MSW** intercepts in dev and tests, one `handlers/<feature>.ts` per feature,
  responses shaped exactly to the contract. Toggle via
  `VITE_API_MOCKS=on|off`.
- **Cutover:** when a backend phase ships, delete that feature's MSW handler and
  fixtures; the `api/` functions already point at the right endpoints. Rework =
  handler deletion + base-URL confirmation only.
- Real endpoints (**not mocked, wired from F3 on**): auth, `/me`, notifications,
  rbac, audit-logs, files.

### Frozen contracts (mocked now)

| Feature | Endpoints |
|---|---|
| dashboard | `GET /dashboard` → KPIs (per-currency), upcoming hearings, urgent deadlines, practice-area split, billing-vs-collections series, my tasks, review docs, recent activity |
| clients | `GET/POST /clients` · `GET/PATCH /clients/:id` · `POST /clients/:id/archive` · `GET/POST /clients/:id/contacts` · `GET /clients/:id/{matters,documents,billing,activity}` |
| matters | `GET/POST /matters` · `GET/PATCH /matters/:id` · `POST /matters/:id/close` · `GET/POST/DELETE /matters/:id/participants` · `GET/POST /matters/:id/updates` · `GET/POST/PATCH/DELETE /matters/:id/notes` · `GET /matters/:id/activity` |
| hearings | `GET /hearings` (+`?matterId`, date range) · `POST /hearings` · `PATCH /hearings/:id` · `POST /hearings/:id/{adjourn,outcome}` |
| tasks | `GET /tasks` (`?mine,?matterId,?status,?overdue`) · `POST /tasks` · `PATCH /tasks/:id` · `POST /tasks/:id/{complete,assign}` |
| documents | `GET /documents` (+`?matterId`) · `POST /documents` (multipart→Core files) · `GET /documents/:id[/content]` · `PATCH/DELETE /documents/:id` |
| calendar | `GET /calendar?from&to&lawyerId` (hearings ∪ deadlines ∪ events) · `POST/PATCH/DELETE /calendar/events` |
| billing | `GET/POST /invoices` · `GET/PATCH /invoices/:id` · `POST /invoices/:id/{issue,send,void}` · `GET/POST /payments` · `PATCH /payments/:id` · `GET/POST /expenses` · `POST /expenses/:id/approve` |
| staff | `GET /team` · `GET /team/:userId` · `POST /team` · `PATCH /team/:userId` |
| settings | `GET/PATCH /lawfirm/settings` (firm profile, matter types, courts, rates, AI toggle) |
| assistant | `POST /lawfirm/assistant/messages` — **stub**, canned responses; actions return `{status:"demo", message}` |

---

## 6. Auth · permissions · tenant

### Auth (real API from F3)

- `POST /api/auth/login {email,password}` → `{user, tokens:{accessToken,
  refreshToken,expiresIn}, organizations:[{id,slug,name,membershipRole}]}`.
- 1 org → straight in. Multiple / none → `/login/organization` selector →
  `POST /api/auth/refresh {organizationId}` to mint an org-scoped token.
- Access token in **memory**; refresh token in `localStorage` (⚠ hardening item —
  backend returns it in JSON, no httpOnly cookie yet). Silent refresh on 401.
- `<ProtectedRoute>` bootstraps session from `/api/me` on load.

### Permissions (§7, §8)

- `can("<action>:<resource>")` using the **exact keys the backend issues** in the
  JWT `perms` claim / `/api/me` — format is `action:resource` (Core convention:
  `create:matter`, `void:invoice`, `record:payment`). The instruction's
  `matter:create` examples are inverted; the backend is the source of truth.
- `<Can perm="create:matter">…</Can>` and `usePermissions()`.
- Gates: **nav items**, **action buttons**, **whole routes**. Frontend authz is
  UX only — **the backend enforces**. Hidden button ≠ secure endpoint.
- Never branch on role name. Roles (`firm_admin`, `partner`, `lawyer`,
  `paralegal`, `finance`, `read_only`) are permission bundles; check permissions.

### Tenant (§9)

- `useOrganization()` → `currentOrganization` from the token. `<OrgSwitcher>` in
  the user menu → `refresh` with a new org id.
- No RLS / DB / tenant-isolation concepts in UI code — high-level context only:
  `currentUser`, `currentOrganization`, `currentPermissions`.

---

## 7. Cross-cutting requirements

### States (§22) — built fresh, not in the prototype

Every list/detail route ships deliberate:

- **loading** — skeletons matching the real row/card shape
- **empty** — explains what happened + primary action *when the user `can` create*
  ("No matters yet — Open the first matter")
- **error** — message + retry
- **403** — permission-denied panel (not a blank screen)
- **404** — not-found page

Wired through Query states + React Router error elements.

### Money

Rendered as per-currency lines from `[{currency, amount}]`. **Never** summed
across currencies. **No** "dominant currency", no FX (locked backend decision).

```
Outstanding
EGP 4,360,000
AED 24,000
```

### Forms (§21)

RHF + Zod · field-level errors · dirty-guard on navigate-away · submit disabled +
spinner (no double-submit) · toast on success/error · optimistic updates where
safe. Financial + destructive actions (`void`, `record payment`, `approve`,
`close matter`, `delete document`, `archive client`) go through `<ConfirmDialog>`
(§20).

### i18n / RTL

All chrome keyed AR + EN; **AR default**; `dir="rtl"` on `<html>` when AR.
Tailwind logical utilities (`ps/pe`, `ms/me`, `start/end`). Dates / numbers /
currency via `Intl` `ar-EG` / `en-EG` (`Africa/Cairo`), mirroring
`core/localization/formatters`. Domain data (names, notes, titles) displayed
as entered — not translated.

### Accessibility (§23) — from the start, not polish

Semantic HTML · Radix keyboard + focus management · visible focus rings ·
labelled controls · SR labels on icon-only buttons · dialog focus traps ·
form-error association · contrast checked (brown `#3B2418` on white passes;
verify the muted greys).

### Responsive (§24)

Desktop-first (the product is used all day at a desk). Targets: desktop → laptop
→ tablet. Below tablet: preserve usability (sidebar → drawer, tables →
horizontally scrollable or key-column card view) — do **not** force every
workflow into a stacked mobile layout, do **not** let it break.

---

## 8. Screen → route → feature → API → permission

| Screen | Route | Feature | API | Nav gate |
|---|---|---|---|---|
| Dashboard | `/` | dashboard | `GET /dashboard` (mock) | `read:dashboard` |
| Clients list | `/clients` | clients | `GET /clients` (mock) | `read:client` |
| Client profile (6 tabs: overview/matters/documents/communications/billing/activity) | `/clients/:id` | clients | `GET /clients/:id` + tab endpoints (mock) | `read:client` |
| Matters list | `/matters` | matters | `GET /matters` (mock) | `read:matter` |
| Matter workspace (7 tabs: overview/hearings/tasks/documents/notes/financials/activity) | `/matters/:id` | matters | `GET /matters/:id` + tab endpoints (mock) | `read:matter` |
| Case Work tab-group (Matters · Hearings · Tasks) | `/matters?tab=` | matters·hearings·tasks | `GET /hearings`, `GET /tasks` (mock) | `read:matter` |
| Calendar (month) | `/calendar` | calendar | `GET /calendar` (mock) | `read:hearing` |
| Documents | `/documents` | documents | `GET /documents`, `POST /documents` (mock; bytes→Core) | `read:document` |
| Finance / Invoices | `/billing` | billing | `GET /invoices` (mock) | `read:invoice` |
| Invoice detail (fee lines · disbursements · VAT · balance) | `/billing/invoices/:id` | billing | `GET /invoices/:id` — server-computed totals (mock) | `read:invoice` |
| Finance tab-group (Invoices · Payments · Expenses) | `/billing?tab=` | billing | `GET /payments`, `GET /expenses` (mock) | `read:payment` / `read:expense` |
| Team | `/team` | staff | `GET /team` (mock) | `read:staff` |
| Notifications | `/notifications` | notifications | **real** `GET /api/notifications` | session |
| Settings — Firm profile / Matter types & courts / Billing & rates / AI assistant | `/settings/*` | settings | `GET/PATCH /lawfirm/settings` (mock) | `read:lawfirm_setting` |
| Settings — Users & roles | `/settings/users` | settings | **real** `/api/rbac/*` | `read:role` |
| Settings — Security & audit log | `/settings/audit` | settings | **real** `/api/audit-logs` | `read:audit_log` |
| Settings — Language & region | `/settings/locale` | settings | client locale switch | `read:lawfirm_setting` |
| Ask Mizan drawer | overlay | assistant | **stub** | session |
| Login / Org select / Forgot / Reset / Verify email | `/login`, `/login/organization`, … | auth | **real** `/api/auth/*` | public |
| 403 / 404 / crash boundary | — | app | — | — |

**Navigation** follows the **design's grouping** (Dashboard · Workspace:
Clients/Matters/Calendar/Documents · Finance · Firm: Team · System:
Notifications/Settings), with Hearings/Tasks and Payments/Expenses as in-page
tab-groups — not instruction §13's flat list (§11 / §29: preserve interaction
patterns). Each area still gets its own `features/` module.

---

## 9. Conflicts & resolutions

| Conflict | Resolution |
|---|---|
| Backend domain unbuilt | Full mock layer now; contracts frozen from Part-1; per-feature cutover later. Accepted rework: delete MSW handlers + confirm base URL. |
| Nav: design groups vs §13 flat list | Follow the design. |
| Permission key order: `action:resource` (backend) vs `resource:action` (some doc examples) | Follow the backend — the keys `/api/me` returns. |
| English design vs AR-first mandate | Ship AR + EN + RTL now. |
| No auth / form / state / 404 screens in the prototype | Build in Mizan language; minimal; field-faithful to the entity models. |
| `web/src/app/` vs repo `app/` | Different roots; frontend imports no repo code. |
| Week / Agenda calendar views | Prototype leaves them unbuilt — ship month view faithfully, Week/Agenda lightweight. Do not build a large calendar system (§17). |

---

## 10. Phases

| Phase | Deliverable |
|---|---|
| **F0 Scaffold** | `web/` package · Vite/TS/Tailwind v4 · `tokens.css` · ESLint/Prettier · folder skeleton · MSW bootstrap · i18n init (ar/en) · providers (Query/Router/Auth/Tenant/I18n/Toaster/ErrorBoundary) · `httpClient` · `<Icon>` · base `tsconfig`. **Gate:** `npm run build` + `typecheck` + `lint` clean; dev server renders a shell. |
| **F1 Design system** | ~25 primitives (§4) on Radix, Mizan-styled, AR/RTL + a11y + loading/disabled variants. Badge tone set. DataTable. CommandMenu. **Gate:** component tests for interactive primitives; visual check vs tokens. |
| **F2 App shell** | `AppShell` (sidebar groups + collapse; topbar: search/⌘K, Ask Mizan, help, notifications bell w/ unread count, user menu + `OrgSwitcher`) · permission-aware nav · breadcrumb · global toaster · error boundary · 403 / 404 pages · route-level loading/empty/error shells. |
| **F3 Auth (real API)** | Login · org selector · forgot / reset password · verify email · session bootstrap + silent refresh · `<ProtectedRoute>`. **Gate:** e2e smoke — login → land on dashboard; multi-org → selector. |
| **F4 Dashboard** | KPI row (per-currency) · upcoming hearings · urgent deadlines · practice-area donut · billing-vs-collections bars · my tasks · docs needing attention · recent activity. |
| **F5 Clients** | List (table/grid, search, filter, sort, paginate) · profile + 6 tabs · create / edit forms · archive (confirm). |
| **F6 Matters** | List (filters) · detail workspace + 7 tabs · Case Work tab-group · open / edit / close · participants · timeline "Add update" (+ file attach) · notes. |
| **F7 Hearings** | List + matter-scoped · schedule / adjourn (chained) / record outcome. |
| **F8 Tasks** | List (Today / This week / Overdue / All, `?mine`) + matter-scoped · create / assign / complete · overdue derivation. |
| **F9 Documents** | List (+ matter filter) · upload (multipart → Core files) · metadata / status edit · download · delete (confirm). |
| **F10 Calendar** | Month grid + event pills (hearings ∪ deadlines ∪ manual events) · lawyer filter · "New event". Week / Agenda lightweight. |
| **F11 Billing** | Finance tab-group. Invoices list · invoice detail (server-computed fee / disb / VAT / total / received / balance — display only) · draft / issue / send (confirm) · void (confirm). Payments list + record (currency must match invoice). Expenses list + record + approve. |
| **F12 Team / Staff** | List + utilization bars · profile · attach / edit staff profile. |
| **F13 Notifications (real API)** | Inbox · unread filter · mark read / read-all · bell badge. |
| **F14 Settings** | 7 sub-sections. Users & roles → real `/api/rbac`. Security & audit → real `/api/audit-logs`. Language & region → locale switch. Rest → mocked firm settings. |
| **F15 Ask Mizan** | Bottom-sheet drawer · suggested prompts · canned responses · confirm → demo-result flow · marked demonstration. No LLM, no fake `{done:true}`. |
| **F16 Polish** | Responsive pass · a11y audit (keyboard, focus, SR labels, contrast) · AR / RTL QA on every screen · side-by-side design comparison · permission-state sweep. |

After every feature phase (§28 Step 5): `typecheck` · `lint` · tests · responsive
check · a11y check · design comparison · permission-state verification.

---

## 11. Definition of done (per feature)

- [ ] Matches the design — hierarchy, spacing, typography, interaction preserved
- [ ] All five states implemented (loading / empty / error / 403 / 404 where applicable)
- [ ] Permission-gated nav + actions; verified with a low-permission session
- [ ] Forms: validation, field errors, dirty guard, no double-submit, success/error feedback
- [ ] Keyboard-navigable; focus visible; icon buttons labelled
- [ ] AR + EN; RTL correct
- [ ] Money shown per-currency, never summed
- [ ] API calls go through `feature/api/` → `httpClient`; no `fetch` in components; no mock imports in components
- [ ] `typecheck` + `lint` clean; component/hook tests for non-trivial logic

## 12. Quality bar (§31)

The result must feel like a production SaaS law-firm product — not a hackathon
prototype, dashboard template, CRUD generator, or a bag of shadcn components.
Every screen answers: who is using this · what are they accomplishing · what
information do they need · what is the primary action · what can go wrong · what
happens with no data · what permissions does the user have.

## 13. Reusability boundary

```
Mizan domain logic          → stays in features/<f>/
Repeated UI pattern (real)   → components/  (shared primitive)
Repeated domain pattern      → candidate for a future AURIC module — ONLY after
across 3 real client builds    it has actually recurred. Not now.
```
