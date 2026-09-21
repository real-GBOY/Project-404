import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ClackRenderer, PlainRenderer, clackPrompter } from "./render.js";
import { run } from "./run.js";

/** The published package root: `dist/cli/main.js` → two levels up. */
const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The process entry point. Chooses the terminal experience (live prompts when a
 * human is at a TTY, plain lines otherwise) and hands everything else to `run`.
 * `AURIC_ASSETS_DIR` points the CLI at another Core snapshot — a development and
 * test seam; a normal install always uses the snapshot bundled in the package.
 */
export async function main(argv: string[]): Promise<number> {
  const assetsDir = process.env.AURIC_ASSETS_DIR ? resolve(process.env.AURIC_ASSETS_DIR) : join(PACKAGE_ROOT, "assets");
  if (!existsSync(join(assetsDir, "core"))) {
    process.stderr.write(
      `✖ This copy of create-auric is missing its Core snapshot (${assetsDir}).\n` +
        `  Reinstall it: npm install -g create-auric@latest (or run it with npx).\n`,
    );
    return 1;
  }
  const version = (JSON.parse(readFileSync(join(PACKAGE_ROOT, "package.json"), "utf8")) as { version: string }).version;

  const tty = Boolean(process.stdout.isTTY && process.stdin.isTTY);
  const verbose = argv.includes("--verbose");

  return run({
    argv,
    cwd: process.cwd(),
    env: process.env,
    write: (text) => void process.stdout.write(text),
    assetsDir,
    version,
    prompter: tty ? clackPrompter : undefined,
    renderer: tty ? new ClackRenderer(verbose) : new PlainRenderer((t) => void process.stdout.write(t), verbose),
  });
}
