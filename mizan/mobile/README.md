# `mizan/mobile/` — Mizan mobile (Phase 2)

**Not built yet.** Placeholder for the Mizan mobile client.

Per `docs/system-architecture.md` §22–24 and `Plan.md`:

- React Native + TypeScript + Expo.
- A **separate client of the same backend** as `mizan/web/` — no backend of its
  own, no repo code imported, HTTP API only.
- May have different UX from web (rule 14); shares the API contracts, not the UI
  components (rule 16 — no DOM/RN component sharing just for reuse).
- Same permission model: `can("action:resource")` from `/api/me` for UX gating;
  the backend stays the security authority.

Build priority is **P2** — after Core + Mizan backend + Mizan web (`P1`, current).
Nothing depends on this folder.
