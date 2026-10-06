import { createPrefixedId, hasIdPrefix } from "@core/kernel/id.js";

/**
 * Prefixed identifiers for Raqib domain rows, mirroring Core's `newId` convention: the format is
 * Core's `createPrefixedId` (`core/kernel/id.ts`); this file owns only the Raqib prefix set.
 *
 *   raqibId("prj") -> "prj_V1StGXR8Z5jdHi6BMyT4c"
 */
export type RaqibIdPrefix =
  | "prj" // project
  | "ste" // site
  | "are" // area
  | "asg" // project assignment
  | "grd" // guard
  | "rtp" // role template
  | "vis" // visit
  | "vev" // visit event
  | "frm" // form
  | "fvr" // form version
  | "ins" // inspection
  | "iit" // inspection item (snapshot)
  | "ans" // answer
  | "dec" // decision
  | "gev" // guard evaluation
  | "obs" // observation
  | "cax" // corrective action
  | "cal" // corrective action log
  | "evd" // evidence
  | "trq" // training request
  | "acr" // account request
  | "rep" // report
  | "rjb" // report job
  | "cnf" // confidential report
  | "cgr" // confidential grant
  | "cal2"; // confidential access log

export const raqibId = (prefix: RaqibIdPrefix): string => createPrefixedId(prefix);

export const hasRaqibPrefix = (id: string, prefix: RaqibIdPrefix): boolean => hasIdPrefix(id, prefix);
