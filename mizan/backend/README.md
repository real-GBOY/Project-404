# `mizan/backend/` — Mizan backend

The server-side of **Mizan** (Project #1). One NestJS 11 modular monolith on the
Fastify adapter, sharing a process with AURIC Core.

- **`app/`** — the Mizan backend: the composition root (`app.module.ts`), the
  layered seed (`seed.ts`), the product version (`version.ts`), and the law-firm
  domain (`app/lawfirm/**` — clients, matters, hearings, tasks, documents,
  billing, staff, settings, dashboard). Full architectural contract and the
  Core ↔ Mizan boundary: **[`app/README.md`](app/README.md)**.

## Where the rest of the backend lives

This folder holds only the Mizan-specific code. The backend **package** is rooted
at the repository root, alongside `core/`:

| At the repo root | Why |
|---|---|
| `main.ts` | entrypoint — migrates, `NestFactory.create` on the Fastify adapter, seeds (Core RBAC + law-firm RBAC), serves `/api`. Imports `./mizan/backend/app/app.module.js`. |
| `package.json` (`@auric/core`) | one package for Core + the Mizan backend; `mizan/backend/app/` imports Core via relative paths (`../../../core/…`). |
| `prisma/`, `prisma.config.ts` | schema + migrations for **both** Core and lawfirm tables. |
| `scripts/`, `http/`, `storage/`, `tsconfig.json`, `vitest.config.ts`, `.swcrc` | shared backend tooling and config. |

Run from the repo root: `npm run serve` (or `npm run dev`).
