# Hotel Transylvania — web

Public landing page for Hotel Transylvania. React 19 · Vite 8 · TypeScript · Tailwind CSS 4 · Motion · Lenis.

```bash
npm install
npm run dev        # http://localhost:4500
npm run build      # type-check + production build into dist/
npm run preview    # serve dist/ locally
npm run lint
```

Requires Node **22.12+** (Vite 8).

- All page copy, prices and contact details: `src/features/landing/data.ts` (currently demo data).
- Photos: `public/images/` (CC0 — sources in `public/images/CREDITS.md`).
- Any path other than `/` renders the 404 page (`src/features/not-found/`).

## Deploying to Vercel

The repo is a monorepo, so the Vercel project must point at this folder.

1. Vercel → **Add New… → Project** → import the GitHub repo.
2. **Root Directory:** `hotel-project/web` (Framework Preset is detected as **Vite**; build, install and
   output settings come from `vercel.json`).
3. Deploy. Every push to the production branch redeploys; other branches get preview URLs.

Optional environment variable:

| Name       | When                          | Example                   |
| ---------- | ----------------------------- | ------------------------- |
| `SITE_URL` | once a custom domain is added | `https://hoteltransylvania.com`  |

`SITE_URL` sets the canonical URL, link-preview (Open Graph) URLs, `robots.txt` and `sitemap.xml`.
Without it the build uses the project's Vercel production domain automatically.

What the build ships:

- `404.html` — Vercel serves it with a real **404** status for unknown URLs.
- `robots.txt`, `sitemap.xml`, favicons, `og-image.jpg` (1200×630 link preview).
- `vercel.json` adds security headers and long-lived caching for hashed assets.
