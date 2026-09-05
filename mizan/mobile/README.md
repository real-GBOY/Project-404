# `mizan/mobile/` — Mizan mobile (Phase 2)

Scaffolded with Expo (SDK 57, `blank-typescript` template): React Native + TypeScript.

Per `docs/system-architecture.md` §22–24 and `Plan.md`:

- A **separate client of the same backend** as `mizan/web/` — no backend of its
  own, no repo code imported, HTTP API only.
- May have different UX from web (rule 14); shares the API contracts, not the UI
  components (rule 16 — no DOM/RN component sharing just for reuse).
- Same permission model: `can("action:resource")` from `/api/me` for UX gating;
  the backend stays the security authority.

## Getting started

```sh
cd mizan/mobile
npm install
npm start        # Expo dev server — scan the QR with Expo Go, or:
npm run android
npm run ios       # macOS only
npm run web
```

Build priority is **P2** — after Core + Mizan backend + Mizan web (`P1`, current).
Nothing else in the repo depends on this folder.
