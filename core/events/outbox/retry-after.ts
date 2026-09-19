/**
 * Throw from an outbox handler to say "try again, but not before `retryAfterMs`".
 * The default backoff (2s, 4s, 8s, 16s) suits transient glitches; it is far too short
 * for a provider that is rate-limiting per minute — retrying every few seconds just
 * burns the whole attempt budget while still limited.
 */
export class RetryAfter extends Error {
  constructor(
    message: string,
    readonly retryAfterMs: number,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "RetryAfter";
  }
}
