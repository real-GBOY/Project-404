import type { ColumnType } from "kysely";

/**
 * JSONB column helper for the generated Kysely schema (`schema.ts`).
 *
 * Read as parsed `T`. On write, a plain object may be passed directly
 * (node-postgres JSON-encodes it), but arrays and primitives must be
 * pre-stringified — so the insert/update type also accepts `string`.
 *
 * Referenced from `prisma/schema/*.prisma` via `/// @kyselyType(Json<...>)`
 * annotations; imported into `schema.ts` through the prisma-kysely `banner`.
 */
export type Json<T> = ColumnType<T, T | string, T | string>;
