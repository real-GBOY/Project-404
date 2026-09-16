// Production build: type-check + emit JS, rewrite the `@core/*` / `@atlas/*` path
// aliases to relative paths (Node can't resolve tsconfig paths at runtime), and
// stage the Prisma schema + config next to the compiled `scripts/migrate.js` so
// `prisma migrate deploy` still finds them at boot.
//
// Because this package's `rootDir` has to cover both `../../core` and this
// package's own `app/`, tsc mirrors that layout under `dist/`:
//   dist/core/…                  (compiled Core, shared with Mizan's own build)
//   dist/atlas/backend/main.js   (the actual entrypoint — NOT dist/main.js)
// `scripts/migrate.ts` deliberately does NOT reuse `core/kernel/db/migrate.ts`
// (see its own header comment) — it locates its "package root" by climbing up
// ONE level from its own compiled location (`dist/atlas/backend/scripts` →
// `dist/atlas/backend`), so `prisma.config.ts` and `prisma/` are staged there,
// next to `main.js` — not at the top of `dist/`.
import { createRequire } from "node:module";
import { cp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const node = (bin, args) =>
  execFileSync(process.execPath, [require.resolve(bin), ...args], { stdio: "inherit" });

const ENTRY_DIR = "dist/atlas/backend";

await rm("dist", { recursive: true, force: true });
node("typescript/bin/tsc", ["-p", "tsconfig.build.json"]);
node("tsc-alias/dist/bin/index.js", ["-p", "tsconfig.build.json"]);
await cp("prisma", `${ENTRY_DIR}/prisma`, { recursive: true });
await cp("prisma.config.ts", `${ENTRY_DIR}/prisma.config.ts`);

console.log(`✓ build → dist/ (run: node ${ENTRY_DIR}/main.js)`);
