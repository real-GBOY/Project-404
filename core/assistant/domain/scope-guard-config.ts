/**
 * The domain vocabulary `ScopeGuard` (core/assistant/application/scope-guard.ts)
 * needs to decide whether a request belongs to a product's own domain. The
 * heuristic → classifier → fail-open *algorithm* is Core; these patterns and
 * strings are 100% product content (Core has no idea what a "matter" or a
 * "unit" is), bound per product via the `SCOPE_GUARD_CONFIG` token.
 */
export interface ScopeGuardConfig {
  /** Obviously in scope — domain entities, product how-to, or a question about
   *  the assistant itself. Skips the classifier call. */
  inScopePatterns: RegExp[];
  /** Greeting / capability / help-me-use-the-app patterns — always in scope. */
  metaPatterns: RegExp[];
  /** Obviously out of scope — general knowledge, coding, content generation, etc. */
  outOfScopePatterns: RegExp[];
  /** System prompt for the one-token IN_SCOPE / OUT_OF_SCOPE classifier call. */
  classifierPrompt: string;
  /** The fixed refusal, per locale. Kept identical every time so it's unmistakable. */
  outOfScopeReply(locale: string): string;
}
