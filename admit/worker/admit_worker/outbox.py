"""The email outbox, from the worker's side.

The NestJS API owns the table: it inserts a QUEUED row in the same transaction as the booking change that causes the
email. This module only claims rows, and records what happened to them. It reads no booking, makes no decision and
never writes anywhere but `admit_email_messages`.

Row lifecycle (status):  QUEUED -> ACCEPTED            the transport accepted it (SMTP 250). Not proof of delivery.
                         QUEUED -> RETRYING -> ...     transient failure, exponential backoff, up to max_attempts
                         ... -> FAILED                 permanent failure or attempts exhausted; shown to staff with Retry
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Any

import psycopg
from psycopg.rows import dict_row


@dataclass(frozen=True)
class Message:
    id: str
    organization_id: str
    booking_id: str | None
    type: str
    to_email: str
    payload: dict[str, Any]
    attempts: int
    max_attempts: int


# One statement claims a batch: due rows, not currently leased by a live worker, locked with SKIP LOCKED so several workers
# (or several replicas of this one) never take the same row. The claim itself is the lease: `claimed_by` + `claimed_at`.
CLAIM_SQL = """
UPDATE admit_email_messages m
   SET claimed_by = %(worker)s, claimed_at = now()
 WHERE m.id IN (
        SELECT id FROM admit_email_messages
         WHERE status IN ('QUEUED', 'RETRYING')
           AND next_attempt_at <= now()
           AND (claimed_at IS NULL OR claimed_at < now() - make_interval(secs => %(lease)s))
         ORDER BY next_attempt_at, created_at
         LIMIT %(limit)s
         FOR UPDATE SKIP LOCKED)
RETURNING m.id, m.organization_id, m.booking_id, m.type, m.to_email, m.payload, m.attempts, m.max_attempts
"""

# Every settle statement is guarded by `claimed_by = worker`: a worker whose lease was taken over after a stall cannot
# overwrite the newer attempt's outcome.
ACCEPT_SQL = """
UPDATE admit_email_messages
   SET status = 'ACCEPTED', attempts = attempts + 1, sent_at = now(), provider_message_id = %(msgid)s,
       last_error = NULL, claimed_by = NULL, claimed_at = NULL
 WHERE id = %(id)s AND claimed_by = %(worker)s
"""

RETRY_SQL = """
UPDATE admit_email_messages
   SET status = 'RETRYING', attempts = attempts + 1, last_error = %(error)s,
       next_attempt_at = now() + make_interval(secs => %(delay)s), claimed_by = NULL, claimed_at = NULL
 WHERE id = %(id)s AND claimed_by = %(worker)s
"""

FAIL_SQL = """
UPDATE admit_email_messages
   SET status = 'FAILED', attempts = attempts + 1, last_error = %(error)s, claimed_by = NULL, claimed_at = NULL
 WHERE id = %(id)s AND claimed_by = %(worker)s
"""


class Outbox:
    def __init__(self, database_url: str, worker_id: str, lease_seconds: int, backoff_base: int) -> None:
        self._url = database_url
        self.worker_id = worker_id
        self._lease = lease_seconds
        self._backoff = backoff_base
        self._conn: psycopg.Connection | None = None

    def _connection(self) -> psycopg.Connection:
        if self._conn is None or self._conn.closed:
            self._conn = psycopg.connect(self._url, autocommit=True, row_factory=dict_row)
        return self._conn

    def close(self) -> None:
        if self._conn is not None and not self._conn.closed:
            self._conn.close()

    def claim(self, limit: int) -> list[Message]:
        try:
            rows = self._connection().execute(CLAIM_SQL, {"worker": self.worker_id, "lease": self._lease, "limit": limit}).fetchall()
        except psycopg.OperationalError:
            self.close()  # reconnect on the next call
            raise
        return [Message(**r) for r in rows]

    def accepted(self, msg: Message, provider_message_id: str) -> bool:
        return self._settle(ACCEPT_SQL, {"id": msg.id, "worker": self.worker_id, "msgid": provider_message_id})

    def retry_later(self, msg: Message, error: str) -> bool:
        """Transient failure: schedule attempt n+1 after backoff_base * 2**(n-1) seconds (n = attempts made so far, including this one)."""
        made = msg.attempts + 1
        if made >= msg.max_attempts:
            return self.failed(msg, error)
        return self._settle(RETRY_SQL, {"id": msg.id, "worker": self.worker_id, "error": error[:1000], "delay": self._backoff * (2 ** (made - 1))})

    def failed(self, msg: Message, error: str) -> bool:
        return self._settle(FAIL_SQL, {"id": msg.id, "worker": self.worker_id, "error": error[:1000]})

    def _settle(self, sql: str, params: dict[str, Any]) -> bool:
        cur = self._connection().execute(sql, params)
        return cur.rowcount == 1


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)
