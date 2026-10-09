# Raqib web

React 19 + Vite + Tailwind 4 front end for Raqib (security quality and field inspection management). It talks only to the Raqib
backend over HTTP (`../backend`), renders the approved Claude Design, works offline for field inspections, and is installable.

```bash
npm run dev          # Vite on :4500, /api proxied to the backend on :3300
npm run typecheck && npm run lint && npm test
npm run build        # tsc -b && vite build
npm run e2e          # real Chrome against the real backend on a throw-away database (see ../docs/operations.md)
#   e2e/90-live-smoke.spec.ts is a READ-ONLY check of a live deployment; it is skipped unless E2E_WEB and E2E_API are set
npm run colors:sync  # regenerate src/styles/tokens.css after editing src/styles/colors.ts
```

## Structure

```text
src/
  main.tsx              entry: providers, service worker registration
  app/                  the shell: App (session gate), Workspace (the signed-in app), routes, useGo, ErrorBoundary
  features/             self-contained product areas built by hand
    auth/               sign-in, the session (AuthProvider, useAuth, idle sign-out)
    account/            account security: two-step verification, password, sessions, forgot password
    onboarding/         the public account-request page and the emailed password-setup page
    demo/               the presenter bar and one-click demo accounts (demo deployments only)
    surveys/            the surveys screen: answer, create, publish and close surveys; the General Manager names who manages them
  ui/generated/         the design's screens (screens/, chrome); ui/vm.ts is their view-model type
  presenters/           view-model builders (state in, view-model out) + the Ctx / Actions contracts; modals/ = dialogs
  hooks/                React hooks: use-screen-data (what a screen reads), use-actions (every command), use-offline-sync,
                        and small effects (document language, frame width, overlay dismissal, …); query-keys.ts
  components/           shared hand-written UI: AuthLayout, Field, Notice, Modal, Toast, EvidenceViewer, SyncStatus, …
  api/                  the typed client: resources/ (one file per backend resource), types/ (one per domain), paging, uploads
  services/             framework-free infrastructure: http client, token store, uploads, api-error text, offline/ (queue, cache)
  state/                UI state (ui-store) and language choice
  i18n/                 Arabic/English string tables and the translator
  config/               env, endpoints
  styles/               colors.ts (the only place for color), typography.ts, form-styles.ts, tokens.css (generated), index.css
```

Dependencies only point down the list above (`architecture.test.ts` enforces it): `config` and `styles` depend on nothing;
`services` on `config`; `api` on `services`; presenters, hooks, components and features build on those; `app` composes all.
Nothing outside `api/` and `services/` calls `fetch`.

## Rules the tests enforce

- **Colors**: no hex or rgba literal anywhere except `src/styles/colors.ts` (`import { C } from "@/styles/colors"`; `C.text.secondary`,
  `C.status.danger.fg`, …). `tokens.css` is generated from it. Fonts are named only in `styles/typography.ts` (`FONT.sans`).
- **Layering** and **no raw fetch** (above), and no source file over 450 lines (generated screens and string tables excepted).
- **Strings**: every literal `i.S("key")` in the code must exist in `src/i18n/strings*.ts` (`i18n/keys.test.ts`), so a screen can never show a raw key.

## Build-time switches

| Variable | Effect |
|---|---|
| `VITE_API_BASE` | The API base URL, including the `/api` suffix (production). In development `/api` is proxied to :3300 |
| `VITE_DEMO=true` | Shows the demo-accounts panel on the sign-in page (always on in development) |
| `VITE_DEMO_SCOPE=client` | A trimmed sidebar (the inspection story only: no guards, training, users, settings, confidential or surveys). Used for the walkthrough video; **off for the real product** |

## How to add things

- **A backend call**: add the route to `config/endpoints.ts`, a function to the matching `api/resources/*.ts`, types to `api/types/*.ts`.
- **A command (create/approve/…)**: add it to the `Actions` contract (`presenters/actions.ts`) and to the matching slice in
  `hooks/use-actions/`; invalidate through `invalidate(qc, QK.…)`.
- **Data a screen reads**: a `want` flag in `hooks/use-screen-data/needs.ts` and an entry in `queries.ts`.
- **A dialog**: its view-model in `presenters/modals/view-model.ts`, required fields in `validation.ts`, its confirm handler in the
  matching file under `presenters/modals/handlers/`.
- **A color**: add it to `styles/colors.ts` under the group that says what it is for, run `npm run colors:sync`.
- **Business rules do not live here.** The backend decides what is allowed; the web only shows and asks.

## Offline

`services/offline/` keeps a per-user IndexedDB cache and an ordered outbox of inspection edits; `public/sw.js` keeps the app shell.
See `../docs/architecture.md` §11.
