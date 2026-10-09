from __future__ import annotations

import json
import os
import uuid

import pytest

try:
    import psycopg
except ImportError:  # pragma: no cover
    psycopg = None

#: The throwaway database the NestJS integration suite migrates (npm test in admit/backend). Override to point elsewhere.
TEST_DB = os.environ.get("ADMIT_TEST_DATABASE_URL", "postgres://postgres:postgres@localhost:5432/admit_test")


def _db_ready() -> bool:
    if psycopg is None:
        return False
    try:
        with psycopg.connect(TEST_DB, connect_timeout=3) as c:
            return c.execute("select to_regclass('public.admit_email_messages')").fetchone()[0] is not None
    except Exception:
        return False


DB_READY = _db_ready()
needs_db = pytest.mark.skipif(not DB_READY, reason="admit_test database is not migrated (run `npm test` in admit/backend once)")


SAMPLE_BASE = {
    "locale": "en",
    "organizer_name": "Nile Sessions Events",
    "support_email": "hello@nilesessions.example",
    "brand_logo_url": "",
    "booking_reference": "ADM-7K4Q2931",
    "customer_name": "Nour Hassan",
    "event_name": "Cairo Jazz Nights: The Nile Sessions",
    "event_date": "Friday 14 November 2026",
    "event_time": "20:00",
    "event_venue": "The Garden Stage",
    "event_address": "26th of July St., Zamalek",
    "event_map_url": "https://maps.example/garden",
    "event_image_url": "",
    "policy_summary": "Refunds up to 72 hours before doors.",
    "status_url": "https://admit.example/b/nile/ADM-7K4Q2931?k=abc",
    "ticket_page_url": "https://admit.example/t/nile/ADM-7K4Q2931?k=abc",
    "upload_url": "https://admit.example/b/nile/ADM-7K4Q2931/upload?k=abc",
}

SAMPLES: dict[str, dict] = {
    "INSTRUCTIONS": {
        "total": "EGP 1,650.00",
        "hold_expires": "Saturday 8 November 2026 at 18:40",
        "items": [{"name": "General admission", "quantity": 2, "line_total": "EGP 1,000.00"}, {"name": "Front standing", "quantity": 1, "line_total": "EGP 650.00"}],
        "payment_methods": [{"label": "InstaPay", "recipient": "Nile Sessions", "identifier": "nile@instapay", "instructions": ["Open InstaPay", "Send the exact total"]}],
    },
    "PROOF_RECEIVED": {},
    "TICKETS": {
        "ticket_count": 2,
        "total": "EGP 1,000.00",
        "tickets": [
            {"ticket_id": "tix_AAA", "ticket_holder_name": "Nour Hassan", "ticket_type": "General admission", "ticket_qr_code_url": "https://api.example/qr/1.png?k=abc", "ticket_url": "https://admit.example/t/x"},
            {"ticket_id": "tix_BBB", "ticket_holder_name": "", "ticket_type": "General admission", "ticket_qr_code_url": "https://api.example/qr/2.png?k=abc", "ticket_url": "https://admit.example/t/x"},
        ],
    },
    "REJECTED": {"rejection_reason": "The receipt shows EGP 1,500 but the total is EGP 1,650 <b>.", "can_resubmit": True},
    "EXPIRED": {},
    "CANCELLED": {},
    "MAGIC_LINK": {},
}


def sample(kind: str, **over) -> dict:
    return {**SAMPLE_BASE, **SAMPLES[kind], **over}


@pytest.fixture()
def org():
    """A throwaway organization (cascade-deleted afterwards, taking its email rows with it)."""
    oid = f"org_test_{uuid.uuid4().hex[:12]}"
    with psycopg.connect(TEST_DB, autocommit=True) as c:
        c.execute("insert into organizations (id, name, slug) values (%s, %s, %s)", (oid, "Worker Test Org", oid.replace("_", "-")))
    yield oid
    with psycopg.connect(TEST_DB, autocommit=True) as c:
        c.execute("delete from organizations where id = %s", (oid,))


@pytest.fixture()
def enqueue(org):
    def _enqueue(kind: str = "PROOF_RECEIVED", payload: dict | None = None, **cols) -> str:
        mid = f"eml_{uuid.uuid4().hex[:16]}"
        with psycopg.connect(TEST_DB, autocommit=True) as c:
            c.execute(
                "insert into admit_email_messages (id, organization_id, type, to_email, payload, status, next_attempt_at, claimed_by, claimed_at, attempts) "
                "values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
                (
                    mid, org, kind, cols.get("to", "nour@example.com"), json.dumps(payload if payload is not None else sample(kind)), cols.get("status", "QUEUED"),
                    cols.get("next_attempt_at", "2000-01-01"), cols.get("claimed_by"), cols.get("claimed_at"), cols.get("attempts", 0),
                ),
            )
        return mid

    return _enqueue


def row(mid: str) -> dict:
    with psycopg.connect(TEST_DB, autocommit=True, row_factory=psycopg.rows.dict_row) as c:
        return c.execute("select * from admit_email_messages where id = %s", (mid,)).fetchone()
