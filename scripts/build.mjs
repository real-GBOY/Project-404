// Production build: type-check + emit JS, rewrite the `@core/*` / `@app/*` path
// aliases to relative paths (Node can't resolve tsconfig paths at runtime), and
// stage the Prisma schema + config next to the output so `prisma migrate deploy`
// still finds them at boot. Output: `dist/`, entrypoint `dist/main.js`.
import { createRequire } from "node:module";
import { cp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";

const require = createRequire(import.meta.url);
const node = (bin, args) =>
  execFileSync(process.execPath, [require.resolve(bin), ...args], { stdio: "inherit" });

await rm("dist", { recursive: true, force: true });
node("typescript/bin/tsc", ["-p", "tsconfig.build.json"]);
node("tsc-alias/dist/bin/index.js", ["-p", "tsconfig.build.json"]);
await cp("prisma", "dist/prisma", { recursive: true });
await cp("prisma.config.ts", "dist/prisma.config.ts");

console.log("✓ build → dist/ (run: node dist/main.js)");
