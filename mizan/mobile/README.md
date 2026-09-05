# `mizan/mobile/` — Mizan mobile

Expo SDK 57 · React Native 0.86 · React 19 · TypeScript (strict) · New Architecture

The native client for the Mizan law-firm ERP. A **separate client of the same
backend** as `mizan/web/` — no backend of its own, no repository code imported,
HTTP API only. It implements all 18 screens of the *"Mizan Mobile App"* Claude
Design canvas, wired to the live API.

> Full write-up — screens, metrics, backend quirks, honesty-about-gaps table —
> is in [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md).

---

## Where it sits in Project-404

```
Project-404 Core  ◀──  Mizan backend  ◀──  ┌ mizan/web     (P1)
                                           └ mizan/mobile   (P2)  ← here
```

- **Rule 14** — mobile may have different UX from web. It does: bottom tabs,
  transparent-modal capture hub, biometric unlock, offline document pinning.
- **Rule 16** — it shares API *contracts*, never UI components. There is no
  DOM/RN component sharing and no shared UI runtime.
- Permissions are `can("action:resource")` derived from `/api/me`, for UX gating
  only. `src/lib/permissions/can.ts` mirrors Core's `permissionMatches`; the
  backend stays the security authority.

---

## Architecture

Feature-sliced, deliberately mirroring `mizan/web` so a change is easy to make in
both clients:

```
src/
  features/<name>/
    api.ts            thin httpClient calls, one function per endpoint
    hooks.ts          TanStack Query hooks (useX / useXMutations)
    types.ts          response shapes — lifted from the web slice, same contract
    presentation.ts   pure row -> view-model mappers (where a slice needs one)
    screens/          the RN screens
    components/        feature-local components
  lib/
    api/              http-client · api-error · query-client
    auth/             token-store (expo-secure-store) · provider · context · events
    permissions/      can("action:resource") — UX gating only
    i18n/             i18next + en/ar resources, one namespace per feature
    format/           ar-EG / en date · money · file-size formatters
  components/ui/       shared primitive kit (Button, Card, Chip, ListRow, …)
  theme/              tokens.ts + typography.ts — native values, web token names
app/                  expo-router file tree — (auth) / (tabs) / stack pushes
```

### The API + auth layer is a near-verbatim port of `mizan/web`

- **One entry point** — `httpClient<T>(path, opts)` attaches the bearer token,
  retries **once** through a token refresh on `401`, and turns every non-2xx
  into a typed `ApiError`.
- **Single-flight refresh** — concurrent `401`s trigger exactly one
  `/auth/refresh`; every other caller awaits the same promise.
- **Tokens in the secure enclave** — access + refresh both live in
  `expo-secure-store` (Keychain / Keystore), never AsyncStorage. The access
  token is mirrored in a module variable for synchronous reads;
  `tokenStore.hydrate()` runs once at boot.
- **Types are shared truth** — `Matter`, `HearingRow`, `TaskRow`, `Client`,
  `DashboardData`, … match the web slices. Both clients break at compile time if
  the backend contract moves.

### Backend behaviours the client respects

- `login` / `refresh` return **`201`**, not `200`.
- Bodyless `POST`s must **not** send `content-type` — Fastify `400`s on an empty
  JSON body, so `httpClient` sets the header only when there is a body.
- Money is `{ currency, amount }` and never summed across currencies.

---

## Getting started

```sh
cd mizan/mobile
npm install
npm start          # Expo dev server — scan the QR with Expo Go, or:
npm run ios        # macOS only
npm run android
npm run web
```

Configuration:

- `EXPO_PUBLIC_API_BASE_URL` — API base per environment (`.env.example` tracked,
  `.env` gitignored). Falls back to the VPS API so a fresh clone talks to the
  real backend immediately.
- `metro.config.js` pins `react` / `react-native` / `react-dom` to this
  package's own `node_modules` (the repo root carries a second React).

---

## Scripts

| Command | Purpose |
|---|---|
| `npm start` · `ios` · `android` · `web` | Expo dev server / platform launchers |
| `npm run typecheck` | `tsc --noEmit` — strict, zero `any` in app code |
| `npm run lint` | ESLint (flat config, `eslint-config-expo` + house rules) |
| `npm run format` / `format:check` | Prettier (`printWidth 100`, same as `mizan/web`) |

`npx expo export` builds clean for iOS / Android / web; `npx expo-doctor`
passes 21/21.

---

## Status

- **18 / 18** design screens · **14** feature slices · **24** expo-router files.
- Wired to the live API and audited endpoint-by-endpoint against real firm data.
- `tsc`, `eslint`, and `prettier --check` all clean.

Known remaining work:

- Not yet run on a physical device — no on-device RTL / responsive visual pass.
- The "Ask Mizan" assistant returns an honest "not connected yet" reply; the
  confirm-action UI is built and ready to wire when the endpoint lands.

See [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) §5 for the full
honesty-about-gaps table.
