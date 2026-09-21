import { SchemaClosureError } from "./schema.js";

/**
 * Errors the developer sees. Every one answers three questions: what happened,
 * why, and what to do next — the CLI prints those, never a raw stack trace
 * (which is kept for `--verbose`).
 */
export type AuricErrorCode =
  | "INVALID_NAME"
  | "DIR_EXISTS"
  | "UNKNOWN_MODULE"
  | "MANIFEST_INVALID"
  | "SCHEMA_CLOSURE"
  | "PRISMA_FAILED"
  | "FS_FAILED"
  | "INSTALL_FAILED"
  | "USAGE"
  | "UNEXPECTED";

export class AuricError extends Error {
  constructor(
    readonly code: AuricErrorCode,
    /** What happened — one line. */
    readonly what: string,
    /** Why it happened. */
    readonly why: string,
    /** What the developer can do next. */
    readonly hint: string,
    override readonly cause?: unknown,
  ) {
    super(what);
    this.name = "AuricError";
  }
}

const PERMISSION_HINT = "Check that you have write permission for that location, or pick another directory.";

const FS_HINTS: Record<string, string> = {
  EACCES: PERMISSION_HINT,
  EPERM: PERMISSION_HINT,
  ENOSPC: "Free some disk space and try again.",
  EEXIST: "Something already exists at that path. Choose another project name.",
  ENOENT: "A path the generator needed does not exist. Try again from an existing directory.",
  EBUSY: "A file is in use by another program. Close it and try again.",
};

/** Turns anything thrown during generation into an {@link AuricError}. */
export function toAuricError(err: unknown): AuricError {
  if (err instanceof AuricError) return err;
  const message = err instanceof Error ? err.message : String(err);
  const code = (err as { code?: unknown } | null)?.code;

  if (err instanceof SchemaClosureError) {
    return new AuricError(
      "SCHEMA_CLOSURE",
      "The selected modules do not form a complete database schema.",
      message.replace(/^Selected modules do not form a closed Prisma schema:\s*/, ""),
      "This is a bug in the module manifests. Please report it, including the modules you selected.",
      err,
    );
  }
  if (/^Unknown module "/.test(message)) {
    return new AuricError(
      "UNKNOWN_MODULE",
      message.split(" (")[0]!,
      message,
      "Run with --help to list the available modules.",
      err,
    );
  }
  if (/^Invalid manifest /.test(message) || /^Duplicate module name/.test(message)) {
    return new AuricError(
      "MANIFEST_INVALID",
      "A module manifest in this package is invalid.",
      message,
      "This package build is broken. Reinstall it, or report the problem.",
      err,
    );
  }
  if (/^prisma [^]* failed:/.test(message)) {
    return new AuricError(
      "PRISMA_FAILED",
      "Prisma could not generate the database schema.",
      message.split("\n").slice(1).join("\n").trim() || message,
      "Re-run with --verbose for the full output. Prisma needs Node 22.12+ and permission to run its engine.",
      err,
    );
  }
  if (typeof code === "string" && code in FS_HINTS) {
    return new AuricError("FS_FAILED", "Could not write the project to disk.", message, FS_HINTS[code]!, err);
  }
  return new AuricError(
    "UNEXPECTED",
    "Something went wrong while generating the project.",
    message,
    "Re-run with --verbose to see the full error, and please report it.",
    err,
  );
}
