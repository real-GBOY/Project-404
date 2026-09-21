import type { ChildProcess } from "node:child_process";
import { rmSync } from "node:fs";

/**
 * Temp directories and helper processes that must not outlive an interrupted run.
 *
 * Normal paths clean up in `finally`. But when the process is told to stop — Ctrl+C in a real terminal
 * arrives as a keypress that @clack answers with `process.exit(0)` — `finally` blocks never run, so the
 * `auric-prisma-*` / `auric-kysely-*` scratch directories (and any Prisma child still running) would be
 * left behind. One synchronous `exit` listener sweeps whatever is still registered.
 */
const dirs = new Set<string>();
const children = new Set<ChildProcess>();
let armed = false;

function sweep(): void {
  for (const child of children) {
    try {
      child.kill();
    } catch {
      /* already gone */
    }
  }
  for (const dir of dirs) {
    try {
      rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch {
      /* best effort: never turn a cancellation into a crash */
    }
  }
}

const arm = () => {
  if (armed) return;
  armed = true;
  process.on("exit", sweep);
};

/** Registers a scratch directory; call the returned function once it has been removed normally. */
export function trackDir(dir: string): () => void {
  arm();
  dirs.add(dir);
  return () => void dirs.delete(dir);
}

/** Registers a helper process; call the returned function once it has finished. */
export function trackChild(child: ChildProcess): () => void {
  arm();
  children.add(child);
  return () => void children.delete(child);
}
