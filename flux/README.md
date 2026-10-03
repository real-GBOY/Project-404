# FLUX

Progressive-overload workout tracker. This folder holds the Expo / React Native app
(`mobile/`) and its design references (`docs/screenshots/`).

> **Status:** front-end only. Sign-in is a deliberate stub (any input signs in), and workout
> history, PRs and the progress charts are generated demo data. Everything else — logging,
> targets, supersets, summaries, persistence — is real.

## Run

```bash
cd mobile
npm install
npm run web        # or: npm run ios / npm run android
npm run check      # typecheck + lint + tests (run before committing)
```

`npm run typecheck`, `npm run lint` and `npm test` run individually. Typed routes are generated
the first time you run `expo start`.

## Layout

```
mobile/
  app/                      expo-router routes — thin: each file renders one screen
  src/
    theme/tokens.ts         every colour, radius, spacing and size (no literals anywhere else)
    components/             shared UI: Card, Badge, TabPills/Chip, ChoiceSheet, Screen, FloatingNav …
    lib/                    storage (versioned), dates, alert
    features/
      training/             the domain — pure logic + state (see below)
      auth/                 session, settings, units, profile types
      onboarding/ home/ builder/ workout/ progress/ stats/ history/ profile/   screens
```

### Dependency rule (enforced by ESLint)

```
features/<screen>  →  features/training, features/auth        (never another screen feature)
features/training  →  nothing in features/*
features/auth      →  nothing in features/*
components, lib, theme →  never features/*
```

## The training domain (`src/features/training`)

| File | Role |
| --- | --- |
| `catalog.ts` | Exercises with tracking type, equipment and rep range. **Add an exercise here only.** |
| `engine.ts` | Progression engine: double-progression targets (with a reason), trend, plateau, plates. Pure. |
| `workout.ts` | Pure reducers: log a set (deltas, PRs, supersets), advance, swap, finalize → session + summary. |
| `format.ts` | How a result / target reads for each tracking type. |
| `persistence.ts` | One AsyncStorage key per slice (`sessions`, `prs`, `routines`, `active`), versioned. |
| `store.tsx` | Thin provider that wires the above into React state. |
| `metrics.ts`, `plan.ts`, `seed.ts` | Streaks / volume, split rotation, demo history. |

### State and re-renders

`store.tsx` exposes four contexts so a change only re-renders what needs it:

- `useTrainingState()` — history, PRs, routines, running workout, summary
- `useTrainingActions()` — stable functions; subscribing never re-renders
- `useWorkoutDraft()` — the weight / reps in the steppers (changes every tap; only the workout and voice screens read it)
- `useRest()` / `useRestRemaining()` — the rest timer; the 250 ms tick lives inside `RestCard`

`useTraining()` merges state + actions for screens that need both.

### Persistence

- Values are stored as `{ v, data }` (`lib/versioned.ts`); unversioned data is version 0. Add a
  migration to the `migrations` map and bump `version` when a shape changes.
- The running workout is saved on every change and restored on launch, so killing the app
  mid-workout loses nothing. A workout that references an exercise that no longer exists is dropped.
- The first launch after the per-slice split imports the old single-key `flux.training.v1.<email>`.

## Conventions

- **Colours** come from `theme/tokens.ts` (ESLint rejects hex / `rgba()` literals elsewhere).
  `app.json` cannot import it — the Android adaptive-icon background must match `colors.lime`.
- **Shared UI first:** use `Badge`/`DeltaBadge`, `TabPills`, `Chip`, `ChoiceSheet` instead of
  re-styling a pill. Add new building blocks to `components/ui`.
- **Logic goes in pure modules with tests**, not in components or the provider.
- Screens over ~300 lines should be split into `components/` next to them.

## Tests

Vitest covers the pure logic (`engine`, `workout`, `format`, `persistence`, `versioned`) with an
in-memory AsyncStorage (`src/test/setup.ts`). UI is not unit-tested; `screenshots` in
`docs/` show the intended result.

## Not built yet

Dark mode (the toggle is a stub), Arabic / RTL, real authentication and backend sync, real
speech-to-text for voice logging (the sheet simulates what was "heard" from the steppers),
per-exercise history aggregated from real sessions (charts use generated data).
