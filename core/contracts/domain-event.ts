/**
 * A domain event: the record of something that happened, past tense.
 * Named `<module>.<pastTenseAction>` (§6). Payloads are versioned alongside
 * the module that owns the event. Handlers must be idempotent.
 */
export interface DomainEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  /** e.g. "user.registered", "organization.member_added". */
  name: string;
  /** Payload contract version; bump on breaking payload changes. */
  version: number;
  payload: TPayload;
  /** Set by the bus at publish time if absent. */
  occurredAt?: Date;
  /** Correlation id of the request that produced the event, if any. */
  correlationId?: string;
}

export function defineEvent<TPayload extends Record<string, unknown>>(
  name: string,
  version: number,
  payload: TPayload,
): DomainEvent<TPayload> {
  return { name, version, payload };
}
