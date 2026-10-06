/**
 * Recognise specific PostgreSQL errors so services can translate a constraint the database
 * enforced into a domain error (`Conflict`), instead of leaking a 500 or the SQL text.
 */
interface PgError {
  code?: string;
  constraint?: string;
}

function asPg(err: unknown): PgError | null {
  return typeof err === "object" && err !== null ? (err as PgError) : null;
}

/** 23505 unique_violation, optionally on a specific constraint/index name. */
export function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const pg = asPg(err);
  return pg?.code === "23505" && (!constraint || pg.constraint === constraint);
}

/** 23P01 exclusion_violation — e.g. two active room allocations overlapping. */
export function isExclusionViolation(err: unknown, constraint?: string): boolean {
  const pg = asPg(err);
  return pg?.code === "23P01" && (!constraint || pg.constraint === constraint);
}
