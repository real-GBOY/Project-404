/**
 * create-auric — the scaffolding engine. Manifests → dependency resolution →
 * schema assembly → database baseline → developer-owned project. The interactive
 * CLI (src/cli) is a thin layer over these functions.
 */
export { applyRegions, isProductRegion, regionNames, removeRegions } from "./regions.js";
export { loadManifests, manifestSchema, MANIFEST_FILE, type Manifest } from "./manifest.js";
export { absentNotes, resolveSelection, type AddedDependency, type Resolution } from "./resolve.js";
export {
  assembleSchema,
  indexUniverse,
  parsePrismaModels,
  SchemaClosureError,
  type AssembledSchema,
  type ModelInfo,
} from "./schema.js";
export {
  assembleMigrations,
  migrationTimestamp,
  prismaBaselineSql,
  rlsTables,
  validatePrismaSchema,
  type GeneratedMigration,
} from "./database.js";
export {
  BASELINE_AT,
  generateKyselyTypes,
  generateProject,
  validateProject,
  type GenerateOptions,
  type GenerateResult,
  type GenerateStats,
  type StageEvent,
  type StageId,
} from "./project.js";
export { AuricError, toAuricError, type AuricErrorCode } from "./errors.js";
export { formatFindings, scanForForbidden, type Finding } from "./audit.js";
