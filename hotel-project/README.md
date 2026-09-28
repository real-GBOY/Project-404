# Hotel Transylvania · HotelOS

The third AURIC product: **HotelOS**, the operations platform behind **Hotel Transylvania**, a four-star
Nile-side hotel in Cairo.

| Package | What | Dev port |
|---|---|---|
| [`backend/`](backend) | HotelOS API — NestJS/Fastify on AURIC Core, own Postgres database | 3200 |
| [`app/`](app) | HotelOS staff application (front desk, housekeeping, maintenance, finance…) | 4600 |
| [`web/`](web) | Public Hotel Transylvania website (live at https://hotel-nayel.vercel.app) | 4500 |

Architecture and the reasoning behind it: [`backend/docs/architecture.md`](backend/docs/architecture.md).

## Run locally

Requires Node 22.12+ and a local PostgreSQL (12+).

```bash
# once, at the repo root — the backend uses the root node_modules
npm install

# backend
cd hotel-project/backend
cp .env.example .env          # set HOTEL_SEED_DEMO=true for the demo hotel
createdb hotelos              # or any database named in AURIC_DATABASE_URL
npm run dev                   # migrates, seeds, serves http://localhost:3200/api (docs: /api/docs)

# staff app (separate terminal)
cd hotel-project/app
npm install
npm run dev                   # http://localhost:4600, proxies /api → :3200
```

Demo sign-in (with `HOTEL_SEED_DEMO=true`), password `demo-password-2026` for everyone:

| Role | Email |
|---|---|
| Owner | ahmed.nabil@hoteltransylvania.com |
| Manager | mona.farid@hoteltransylvania.com |
| Receptionist | youssef.adly@hoteltransylvania.com, rania.kamal@hoteltransylvania.com |
| Accountant | dina.samir@hoteltransylvania.com |
| Housekeeping | hassan.ali@hoteltransylvania.com, salma.mahmoud@hoteltransylvania.com |
| Maintenance | omar.tarek@hoteltransylvania.com |

## Checks

```bash
cd hotel-project/backend && npm run ci   # typecheck · lint · format · unit + integration · build
cd hotel-project/app && npm run ci       # typecheck · lint · format · unit · build
cd hotel-project/app && npm run e2e      # Playwright against the real backend (npm run e2e:install once)
```

Integration tests use the `hotel_test` database and end-to-end tests `hotel_e2e`; both are
created and reset automatically.
