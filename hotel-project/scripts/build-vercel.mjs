// One Vercel project, two apps: the public site at `/` and the HotelOS staff app at `/app/`.
// Builds both and merges them into hotel-project/site (the project's output directory).
import { execSync } from "node:child_process";
import { cpSync, rmSync } from "node:fs";

const run = (cmd, cwd, env = {}) =>
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, ...env } });

rmSync("site", { recursive: true, force: true });
run("npm run build", "web");
run("npm run build", "app", { HOTEL_APP_BASE: "/app/" });
cpSync("web/dist", "site", { recursive: true });
cpSync("app/dist", "site/app", { recursive: true });
console.log("✓ site/ = public site (/) + staff app (/app/)");
