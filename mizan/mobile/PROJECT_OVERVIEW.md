# Mizan Mobile — Project Overview

> The native companion to the Mizan Law‑Firm ERP. Same backend, same permission
> model, same institutional identity — rebuilt from the ground up as a
> touch‑first app, not a shrunk‑down website.

---

## 1. What it is

`mizan/mobile/` is an **Expo / React Native** application that puts the full
Mizan case‑management workflow — cases, hearings, tasks, clients, documents,
billing, calendar — in a lawyer's pocket. It is the **P2** client in the
Project-404 platform: a *separate client of the same API* as `mizan/web/`,
sharing the backend contract and nothing else (no DOM components, no shared UI
runtime).

It implements **all 18 screens / 5 flows** of the Claude Design canvas
*"Mizan Mobile App.dc.html"* — feature‑complete, wired to the **live production
API**, and audited endpoint‑by‑endpoint against real firm data.

---

## 2. The flex — by the numbers

| Metric | Value |
| --- | --- |
| Design screens delivered | **18 / 18** (100%) |
| User flows | **5** (Today, Cases, Calendar, Files, More + capture/assistant modals) |
| Feature slices | **14** — `dashboard, matters, hearings, tasks, clients, documents, billing, calendar, notifications, settings, team, timeentries, capture, assistant` |
| Route files (expo‑router) | **24** |
| TypeScript / TSX | **~8,700 LOC** across **129 files**, `tsc` **clean**, zero `any` in app code |
| Lint / format | `eslint` (flat config, `eslint-config-expo` + house rules) **clean**, `prettier --check` **clean** |
| Languages | **English + Arabic**, full **RTL** (`I18nManager.forceRTL` + restart flow) |
| Live‑API audit | **28 / 28** reads + auth/refresh/logout + key mutations — every response shape matches the ported types |
| Build health | `expo export` clean for **iOS + Android + web**, `expo-doctor` **21 / 21** |
| Runtime | **Expo SDK 57**, **React Native 0.86.3**, **React 19.2**, **New Architecture** |
| Fonts shipped | **11 faces** — Spectral, Public Sans, Amiri, IBM Plex Sans Arabic |
| Backend of its own | **0 lines** — HTTP API only, backend stays the security authority |

---

## 3. Architecture

### Feature‑sliced, mirrors `mizan/web`

```
src/
  features/<name>/
    api.ts          # thin httpClient calls, one per endpoint
    hooks.ts        # TanStack Query hooks (useX / useXMutations)
    types.ts        # response shapes — lifted from the web slice, same contract
    presentation.ts # pure row -> view-model mappers (where a slice needs one)
    screens/        # the actual RN screens
    components/      # feature-local components
  lib/
    api/            # http-client, api-error, query-client
    auth/           # token-store (expo-secure-store), provider, context, events
    permissions/    # can("action:resource") from /api/me — UX gating only
    i18n/           # i18next + en/ar resources, one namespace per feature
  components/ui/     # the shared primitive kit (Button, Card, Chip, ListRow, …)
  theme/            # tokens.ts + typography.ts
app/                # expo-router file tree — (auth) / (tabs) / stack pushes
```

### The API layer is a near‑verbatim port

`src/lib/api/http-client.ts`, `lib/auth/*`, `lib/permissions/*` are ports of the
web app's equivalents. That means **one mental model across both clients**:

- **Single entry point** — `httpClient<T>(path, opts)` attaches auth, retries
  **once** through a token refresh on `401`, and turns every non‑2xx into a
  typed `ApiError`.
- **Single‑flight refresh** — concurrent `401`s trigger exactly one
  `/auth/refresh` call; everyone else awaits the same promise.
- **Tokens in the secure enclave** — both access + refresh live in
  `expo-secure-store` (Keychain / Keystore), not AsyncStorage.
  `tokenStore.hydrate()` runs once at boot.
- **Types are shared truth** — `Matter`, `HearingRow`, `TaskRow`, `Client`,
  `DashboardData`, … are lifted from the web slices unchanged. Both clients
  break at compile time if the backend contract moves.

### Backend quirks discovered and handled

The live‑API audit turned up real Fastify behaviours the client has to respect,
and `httpClient` already gets them right:

- `login` / `refresh` return **`201`**, not `200`.
- **Bodyless `POST`s must not send `content-type`** — Fastify `400`s on an empty
  JSON body. The client only sets the header when there's actually a body.
- `finance/summary` `d` (unbilled) is `[]` server‑side — the screen renders the
  empty state honestly rather than faking a number.

---

## 4. The 18 screens

| # | Flow | Screen | Route | Notes |
| --- | --- | --- | --- | --- |
| 1 | Today | `TodayScreen` | `(tabs)/today` | Dashboard — hearings, tasks, activity |
| 2 | Cases | `CasesScreen` | `(tabs)/cases` | Searchable matter list |
| 3 | Cases | `CaseDetailScreen` | `case/[matterId]` | Full‑screen push — parties, hearings, docs, finance |
| 4 | Cases | `HearingScreen` | `hearings/[id]` | Check‑in, attendees, outcome (adjourn / pleadings / judgment — **real** endpoints) |
| 5 | Cases | `TasksScreen` | `tasks` | Firm/my task queue, status transitions |
| 6 | Calendar | `CalendarScreen` | `(tabs)/calendar` | Agenda + day view of hearings & deadlines |
| 7 | Files | `FilesScreen` | `(tabs)/files` | Document browser, matter‑scoped |
| 8 | Files | `OfflineDocumentsScreen` | `settings/offline-documents` | Pinned‑for‑offline queue |
| 9 | Clients | `ClientsScreen` | `clients` | Client directory |
| 10 | Clients | `ClientProfileScreen` | `clients/[id]` | Contact card, matters, call / email actions |
| 11 | Billing | `FinanceScreen` | `finance` | Matter finance — billed / collected / unbilled |
| 12 | Billing | `ExpenseScreen` | `capture/expense` | Photo → real `POST /documents`, fields → real `POST /expenses` |
| 13 | Capture | `QuickCaptureScreen` | `capture/` | Transparent‑modal action hub (FAB target) |
| 14 | Capture | `LogTimeScreen` | `capture/log-time` | Time entries — real `GET/POST/PATCH/DELETE /time-entries`, timer + presets, billable toggle |
| 15 | Assistant | `AssistantScreen` | `assistant/` | Labelled preview — honest "not connected" reply; `ConfirmActionCard` built & reusable |
| 16 | More | `MoreScreen` | `(tabs)/more` | Settings hub, language switch, sign‑out |
| 17 | More | `AuditLogScreen` | `settings/audit-log` | Real activity feed |
| 18 | Notifications | `NotificationsScreen` | `notifications` | Real notifications adapter, mark‑read |

Plus the auth flow: `(auth)/sign-in` with an organization check and post‑login
routing.

---

## 5. Honesty about backend gaps

The user's call was **"ship all 18, stub the unbacked — but never lie about it"**.
Where the API doesn't exist yet, the app degrades visibly instead of faking:

| Gap | What the app does instead |
| --- | --- |
| Expense OCR | Dropped the "auto‑read" banner; photo → real document upload, fields entered manually → real expense |
| Ask Mizan | Composer returns one honest "assistant isn't connected yet" reply; the confirm‑action UI is real and ready to wire |
| Hearing check‑in / bundle | Check‑in = local timestamp; attendees = **real** matter participants; outcomes = **real** endpoints |
| "+" affordances with no designed screen (new case / task / event) | `src/lib/not-available.ts` — a single "not part of the current design yet" alert instead of a silent no‑op |

Time entries were on this list while the backend lacked an endpoint; they now
run against real `/time-entries` routes.

`src/lib/not-available.ts` centralises the "not available yet" messaging so it
is one consistent string, not scattered ad-hoc alerts.

---

## 6. Design system — its own skin, shared bones

Mobile runs the **same institutional identity** as the web app — *Court Navy /
Brass / Paper*, *Spectral + Public Sans + Amiri* — but as a **native token set**
(`src/theme/tokens.ts`), not the web's CSS variables. Token **names** are kept
identical to `mizan/web` so screen code barely differs between the two codebases;
only the values are native.

- **Warm, never white** — `#F5F3EF` Paper background, `#FAF9F6` cards.
- **Institutional radii** — 3–8px, never pill‑shaped for surfaces (pills reserved
  for toggles and the tab bar).
- **Icons mapped by meaning** — `src/components/ui/Icon.tsx` maps design intent to
  `@expo/vector-icons` (Material Symbols has no RN equivalent), so screens say
  `<Icon name="gavel" />` not a raw glyph name.
- **A real primitive kit** — `Button, Card, Chip, ListRow, SearchBar, StatusBadge,
  Avatar, BottomSheet, EmptyState, StickyFooterBar, DateTimeField, TopBar,
  SectionHeader, MatterRefBadge, Toggle, Logo` — all token‑driven.

---

## 7. Internationalisation & RTL

- `i18next` + **real `en` / `ar` resource files** (~210 lines each), **one
  namespace per feature** — same shape as web's `en.json`.
- Language switch persists, flips `I18nManager.forceRTL`, and prompts for the
  native restart RTL requires (`src/lib/i18n/restart.ts`).
- Default `en`, **no device‑locale auto‑detect** (deliberate — matches web
  policy).
- Root layout defensively re‑checks `I18nManager.isRTL` against the stored locale
  before first paint.

---

## 8. Native capabilities wired

`expo-secure-store` (tokens) · `expo-image-picker` + `expo-document-picker`
(capture) · `expo-file-system` (document download) · `expo-local-authentication`
(biometric unlock) · `expo-haptics` · `expo-blur` (sheet backdrops) ·
`expo-updates` (OTA) · `react-native-reanimated` v4 + worklets ·
`react-native-safe-area-context` (tab bar & FAB respect the notch / home
indicator).

---

## 9. Build & verification status

**Verified:**

- `npm run typecheck` (`tsc --noEmit`) — **clean**
- `npm run lint` (`eslint`) — **clean**
- `npm run format:check` (`prettier`) — **clean**
- `expo export` — **clean** for iOS, Android, and web
- `expo-doctor` — **21 / 21**
- Live‑API audit against `https://13-220-157-42.sslip.io/api`
  (demo login `mahmoud.nayel@tawfikpartners.eg`) — **28 / 28** reads plus
  auth / refresh / logout and key mutations, all response shapes matching the
  ported types.

**Known remaining work:**

- Not yet run on a physical device — no on‑device RTL / responsive visual pass.
- The "Ask Mizan" assistant endpoint is stubbed pending backend support (the
  confirm‑action UI is built and ready to wire).

---

## 10. Getting started

```sh
cd mizan/mobile
npm install
npm start          # Expo dev server — scan the QR with Expo Go, or:
npm run ios        # macOS only
npm run android
npm run web
```

Configuration:

- `EXPO_PUBLIC_API_BASE_URL` — API base per environment (`.env.example`
  tracked, `.env` gitignored). Falls back to the VPS API so a fresh clone can
  talk to the real backend immediately.
- `metro.config.js` pins `react` / `react-native` / `react-dom` to the app's own
  `node_modules` (the repo root carries a second React).

---

## 11. Where it sits in Project-404

```
Project-404 Core  ◀──  Mizan backend  ◀──  ┌ mizan/web    (P1)
                                           └ mizan/mobile  (P2)  ← you are here
```

- **Rule 14** — mobile may have different UX from web.
- **Rule 16** — it shares API contracts, never UI components.
- Permissions are `can("action:resource")` from `/api/me`, for UX gating only —
  the backend remains the security authority.

Nothing else in the repo depends on this folder.
