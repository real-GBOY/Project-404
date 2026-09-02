# Mizan Frontend — Code Architecture

How the code is organised and the rules every file follows. `PLAN.md` is *what*
and *in what order*; this is *how*.

---

Structure follows `docs/system-architecture.md` §18.

## 1. Dependency direction (hard rule)

```
app/            router + providers + layouts (composition root)
  │
  ▼
features/<f>/   pages · components · hooks · api · schemas · types   (the Mizan domain)
  │
  ▼
components/{ui,forms,tables,feedback,navigation}   +   lib/{api,auth,permissions,tenant,i18n,format}
  │                                                     │
  └──────────────────────────┬──────────────────────────┘
                             ▼
                       styles/ (tokens)

hooks/   cross-feature hooks — may use lib/, never features/ or components/
types/   shared API contract types — no imports
```

- A **feature never imports another feature.** Cross-feature need → lift the piece
  into `lib/` or `components/`, or let the *route* compose both pages.
- `components/` imports only `lib/format`, `lib/i18n`, `styles`. Never `features/`,
  never `lib/api`.
- `lib/` imports nothing from `features/` or `components/`.
- **Only `lib/api/*` and `mocks/*` know URLs or call `fetch`.** Nothing else.
- `web/` imports **nothing** from the repo (`core/`, `app/`) — HTTP API only.
- No circular deps between features (enforced by review; ESLint `import/no-cycle`
  can be added if it recurs).

---

## 2. Feature module anatomy

Every `features/<f>/` has the same shape:

```
features/matters/
├── api/
│   ├── matters.api.ts      typed fns: listMatters(params) getMatter(id) createMatter(body) …
│   │                       pure (params) => Promise<T>; call httpClient; throw ApiError; no React
│   └── matters.keys.ts     query-key factory: matterKeys.list(params) .detail(id) .tab(id,'hearings')
├── schemas/
│   └── matter.schema.ts    zod: createMatterSchema, updateMatterSchema  (FORM validation only)
├── types/
│   └── matter.ts           Matter, MatterListItem, MatterStatus …       (API SHAPE only)
├── hooks/
│   ├── use-matters.ts      useQuery wrappers — the ONLY thing pages call for data
│   └── use-matter-mutations.ts   useMutation + cache invalidation
├── components/
│   └── matter-*.tsx        feature-specific presentational components
├── pages/
│   └── matter-*-page.tsx   route entry points; own the 5 states (§7)
└── index.ts                barrel — exports pages + route config ONLY, never internals
```

`schemas/` (form input contracts) and `types/` (server response contracts) are
kept separate on purpose — they diverge (a form has no `id`/`createdAt`; a
response has no raw password).

---

## 3. Data flow

```
Page ──▶ feature hook (useQuery / useMutation) ──▶ feature api fn ──▶ lib/api httpClient ──▶ HTTP
                                                                          ▲
                                                                    MSW intercepts (dev/test)
```

- **Reads:** a `useQuery` in `hooks/`. Pages never call `api/` functions directly.
- **Writes:** a `useMutation` in `hooks/` that invalidates the affected keys and
  toasts on success/error.
- **Query keys:** one factory per feature.
  `['matters','list',params]` · `['matters','detail',id]` · `['matters','detail',id,'hearings']`.
  Mutations invalidate at the coarsest safe level.
- Server data is **never copied into `useState`.** Query cache is the single source.

```ts
// hooks/use-matters.ts
export function useMatters(params: MatterListParams) {
  return useQuery({
    queryKey: matterKeys.list(params),
    queryFn: ({ signal }) => listMatters(params, signal),
  });
}
```

---

## 4. `lib/` contracts

### `lib/api`
- `httpClient<T>(path, { method?, body?, query?, signal? }): Promise<T>`
- base URL `import.meta.env.VITE_API_BASE ?? "/api"`
- attaches `Authorization: Bearer <access>` from `tokenStore`
- on **401**: single-flight `POST /api/auth/refresh { refreshToken }`, retry the
  request once; on refresh failure → `authEvents.emit("logout")`
- non-2xx → `throw new ApiError({ status, code, message, fields? })`, mapped from
  the backend `AppError` body `{ code, message, details:{ fields } }`
- `queryClient` config: `staleTime` 30s, 1 retry (not on 4xx), no refetch-on-focus
  for mut(heavy) lists

### `lib/auth`
- `AuthProvider` — bootstraps from `GET /api/me` on mount; exposes
  `useAuth() → { user, status: "loading" | "authed" | "anon" }`
- `tokenStore` — access token in memory; refresh token in `localStorage`
  (⚠ hardening item, noted in PLAN §6)
- login / selectOrg / logout live here; `authEvents` bus for the httpClient

### `lib/tenant`
- `TenantProvider` — active org decoded from the access token
- `useOrganization() → { organization, organizations, switchTo(id) }`
- `switchTo` → `POST /api/auth/refresh { organizationId }` → new token → refetch all

### `lib/permissions`
- `usePermissions() → { can }`; `can("action:resource")` — **exact backend key**,
  `*` wildcard aware (mirrors `permissionMatches` in Core)
- `<Can perm="void:invoice" fallback={…}>…</Can>`
- perms come from the token claims / `/api/me` — never a role-name check
- **every gate carries a comment: UX only; the backend enforces.**

### `lib/i18n`
- i18next, namespaces per feature + `common` / `auth`; `ar.json` / `en.json`
- `ar` is the default language
- `useDir()` sets `<html lang dir>` from the active language

### `lib/format`
- `formatDate(v, { style })` · `formatNumber(v)` · `formatMoney({ currency, amount })`
- `formatMoneyList([{currency,amount}]) → string[]` — rendered as stacked lines,
  **never summed across currencies**
- all wrap `Intl` with the active locale + `Africa/Cairo`; mirrors
  `core/localization/formatters`

---

## 5. State ownership

| Kind | Home |
|---|---|
| Server data | TanStack Query cache (only) |
| Session / current user | `AuthProvider` context |
| Active organization | `TenantProvider` context |
| Permissions | derived from token via `usePermissions()` |
| Filters, active tab, pagination | **URL search params** (shareable, back-button safe) |
| Dialog open/closed, hover, local toggles | `useState` |
| Form fields + validation | react-hook-form |

No Redux/Zustand. If a genuinely global client state appears that isn't one of
the above, revisit — don't pre-add a store.

---

## 6. Routing & providers

Provider nesting (outer → inner), in `app/providers.tsx`:

```
<QueryClientProvider>
  <I18nextProvider>          set lang + dir
    <BrowserRouter>
      <AuthProvider>          bootstrap session; navigates on logout
        <TenantProvider>
          <TooltipProvider>
            <AppRoutes />
            <Toaster />
```

`app/routes.tsx`:
- `AppShell` is a layout route; auth screens use `AuthLayout`
- each feature contributes a lazy route (`React.lazy` + `Suspense`)
- guards: `<ProtectedRoute>` (redirect to `/login` if anon) then
  `<RequirePermission perm="read:matter">` (renders `<ForbiddenState>` if denied)
- every route has `errorElement={<RouteError />}` and a route-shaped Suspense
  fallback

---

## 7. The five states — wired the same way everywhere

```tsx
function MattersListPage() {
  const { can } = usePermissions();
  const { t } = useTranslation("matters");
  const [params, setParams] = useMatterListParams();   // URL search params
  const q = useMatters(params);

  if (q.isPending) return <MattersTableSkeleton />;
  if (q.isError)   return <ErrorState error={q.error} onRetry={q.refetch} />;
  if (q.data.items.length === 0)
    return (
      <EmptyState
        icon="gavel"
        title={t("empty.title")}
        description={t("empty.body")}
        action={can("create:matter") ? <NewMatterButton /> : undefined}
      />
    );
  return <MattersTable data={q.data} onParamsChange={setParams} />;
}
```

- **403** — the route guard `<RequirePermission>` renders `<ForbiddenState>`
  instead of the page.
- **404** — unknown URL → `<NotFoundPage>`; an API 404 from `getMatter` →
  `<NotFoundState>` inside the detail page.
- Skeletons match the real row/card geometry, not a generic spinner.

---

## 8. Mock layer & cutover

- `mocks/handlers/<feature>.ts` — MSW handlers returning contract-shaped JSON
  from `mocks/fixtures/`.
- Active when `import.meta.env.VITE_API_MOCKS !== "off"` (default **on** until the
  matching backend phase ships).
- Started in `main.tsx` before render (browser) and in `test/setup.ts` (`server`).
- **Cutover per feature:** delete `handlers/<feature>.ts` and its entry in
  `handlers/index.ts`. The feature's `api/` functions already target the real
  route. Nothing in components/hooks/pages changes.

---

## 9. Design-system layer (`components/`)

- `components/ui/*` — the ~25 primitives. `cva` for variants, `cn()` (clsx +
  tailwind-merge) for class merge.
- Radix under the hood for anything interactive (Dialog, DropdownMenu, Tabs,
  Popover, Tooltip, Select, Checkbox, RadioGroup, Switch, Avatar, Label).
- Every primitive: `forwardRef`, spreads `...props`, sets `data-slot`, no
  feature-specific props (composition over configuration).
- **No hex values in components** — Tailwind theme tokens / CSS vars only.
- Logical utilities only: `ps-/pe- ms-/me- start-/end- text-start` — never
  `pl-/pr- left-/right-`.
- `Badge` carries the tone set (`success warning danger info neutral brand teal`)
  matching the design's `TONES`.

---

## 10. Naming & files

- files `kebab-case.tsx`; components `PascalCase`; hooks `use-thing.ts` → `useThing`
- API fns: verbs — `listMatters`, `getMatter`, `createMatter`, `closeMatter`
- one component per file (small siblings allowed if private to it)
- barrels only at `features/<f>/index.ts`, exporting pages + route config
- no `utils/` dumping ground — helpers live next to their use or in `lib/<area>`

---

## 11. Testing

| Layer | Test |
|---|---|
| primitives | RTL: keyboard, focus, aria, variant classes |
| hooks | `renderHook` + MSW; loading → data, error path, mutation invalidation |
| pages | render with providers + MSW; assert each of the 5 states |
| permissions | `can()` unit tests incl. wildcards; a page renders `<ForbiddenState>` for a low-perm session |
| e2e (Playwright) | login → dashboard · multi-org → selector · create matter · record payment · switch org |

Gate after every phase: `typecheck` · `lint` · `test` · responsive check · a11y
check (keyboard + axe) · design comparison · permission-state check.

---

## 12. What this architecture deliberately avoids

- generic abstractions (`GenericEntityTable`, `IndustryDashboard`) — §27
- a component becoming "shared" before it is actually shared twice
- `fetch` / mock data / hex colours / raw `Intl` outside their designated layer
- global stores for what is server state or URL state
- gating security in the client (every gate is UX; the backend is authoritative)
- redesigning the provided design because another pattern is easier to code
