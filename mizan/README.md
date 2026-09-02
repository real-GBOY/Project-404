# `mizan/` — Project #1

**Mizan** (codename *Project 404*) is a law-firm management system for
Tawfik & Partners — the first real application built on **AURIC Core** (`core/`,
at the repository root). Core is the domain-agnostic foundation; `mizan/` is the
product.

| Part | Path | Status |
|---|---|---|
| Backend / domain | [`backend/app/lawfirm/`](backend/app/README.md) | in progress (Part-1 phases) |
| Web client | [`web/`](web/README.md) | F0–F16 built, MSW-backed |
| Mobile client | [`mobile/`](mobile/README.md) | Phase 2 (placeholder) |

All three speak to the **same HTTP API**.

## Boundary

```
core/   ──X──▶  mizan/     Core MUST NOT import client-domain code (verified: grep is empty).
mizan/  ─────▶  core/      Only via core/contracts interfaces + DI tokens.
```

The authoritative Core ↔ Mizan boundary — what each side owns, how Mizan reaches
Core, why there is no `modules/` / `client-00N/` yet (Rule of Three) — is
**`docs/mizan-project-one.md`**.

## What stayed at the repo root (and why)

The backend is one NestJS modular monolith. `main.ts` (the entrypoint that
composes Core + the Mizan backend), the `@auric/core` `package.json`, `prisma/`
(schema + migrations for Core *and* lawfirm tables), `scripts/`, `http/`,
`storage/`, and all build config stay at the root — the backend npm package is
rooted where `core/` is. `mizan/backend/app/` is the Mizan-specific slice of that
package, cleanly separated from `core/`.

`mizan/web/` is a fully standalone package (`mizan-web`) — nothing at the repo
root references it.
