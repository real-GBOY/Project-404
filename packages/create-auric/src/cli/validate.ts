import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { AuricError } from "../errors.js";

const RESERVED = new Set(["node_modules", "favicon.ico", "package.json", "src", "dist", "prisma", "scripts", "test", "core", "auric"]);

/** Returns a problem description, or undefined when `name` is a usable project name. */
export function projectNameProblem(name: string | undefined): string | undefined {
  if (name === undefined || name.trim() === "") return "Enter a project name.";
  if (name !== name.trim()) return "The name can't start or end with a space.";
  if (name.length > 214) return "The name must be 214 characters or fewer.";
  if (name.startsWith("@") || name.includes("/")) return "Use a plain name (no scope or slashes) — it is also the folder name.";
  if (name.startsWith(".") || name.startsWith("_")) return "The name can't start with a dot or underscore.";
  if (/[A-Z]/.test(name)) return "Use lowercase letters only (npm package names are lowercase).";
  if (/[^a-z0-9._~-]/.test(name)) return "Use only lowercase letters, digits, hyphens, dots and underscores.";
  if (RESERVED.has(name)) return `"${name}" is reserved. Choose another name.`;
  return undefined;
}

export function assertProjectName(name: string | undefined): string {
  const problem = projectNameProblem(name);
  if (problem) {
    throw new AuricError(
      "INVALID_NAME",
      `"${name ?? ""}" is not a valid project name.`,
      problem,
      "Try something like `acme-platform`.",
    );
  }
  return name!;
}

/** Resolves the target directory and refuses to touch one that already holds files. */
export function assertTargetFree(cwd: string, name: string): string {
  const dir = resolve(cwd, name);
  if (existsSync(dir)) {
    const stat = statSync(dir);
    if (!stat.isDirectory() || readdirSync(dir).length > 0) {
      throw new AuricError(
        "DIR_EXISTS",
        `Directory "${name}" already exists and isn't empty.`,
        "create-auric never overwrites existing files.",
        "Choose a different name, or remove the directory first.",
      );
    }
  }
  return dir;
}

/** The problem with a target directory as a message (for the interactive prompt), or undefined. */
export function targetProblem(cwd: string, name: string): string | undefined {
  try {
    assertTargetFree(cwd, name);
    return undefined;
  } catch (err) {
    return err instanceof AuricError ? err.what : String(err);
  }
}
