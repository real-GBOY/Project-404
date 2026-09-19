/**
 * `StructuredAi` (single-shot, schema-validated JSON completion with one repair retry) is
 * Core's — `core/assistant/application/structured-ai.ts`. This re-export keeps Atlas's
 * existing import path working; what stays HERE is the meaning: lead-intelligence's prompts
 * (`prompts.ts`) and schemas (`requirements.schema.ts`).
 */
export { StructuredAi } from "@core/assistant/application/structured-ai.js";
