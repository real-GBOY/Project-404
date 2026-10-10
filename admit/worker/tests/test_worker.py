from __future__ import annotations

import datetime as dt
import json
import threading

import psycopg
import pytest

from admit_worker.config import Config
from admit_worker.outbox import Outbox
from admit_worker.transport import PermanentError, TransientError
from admit_worker.worker import Worker
from conftest import SAMPLES, TEST_DB, needs_db, row, sample

pytestmark = needs_db


def cfg(tmp_path, **over) -> Config:
    base = dict(
        database_url=TEST_DB, transport="log", smtp_url="", mail_from="Admit <tickets@admit.example>", outbox_dir=tmp_path / "outbox", poll_interval=0.1,
        batch_size=50, lease_seconds=300, backoff_base=60, worker_id="test-worker",
    )
    base.update(over)
    return Config(**base)


class Flaky:
    """A transport that fails with the given errors, then succeeds."""

    def __init__(self, *errors):
        self.errors = list(errors)
        self.sent = []

    def send(self, msg):
        if self.errors:
            raise self.errors.pop(0)
        self.sent.append(msg)
        return f"<id-{len(self.sent)}@test>"


def only(mid):
    """Restrict a worker's claims to one message by making every other due row not due (tests share one database)."""
    return mid


def run_for(w: Worker, ids: list[str]) -> None:
    # claim, then process only ours (other tests' leftover rows in the shared database are released untouched)
    batch = w.outbox.claim(500)
    mine = [m for m in batch if m.id in ids]
    with psycopg.connect(TEST_DB, autocommit=True) as c:
        for m in batch:
            if m.id not in ids:
                c.execute("update admit_email_messages set claimed_by = null, claimed_at = null where id = %s", (m.id,))
    for m in mine:
        w.process(m)


def test_delivers_and_marks_accepted(tmp_path, enqueue):
    ids = [enqueue(k) for k in sorted(SAMPLES)]
    w = Worker(cfg(tmp_path))
    run_for(w, ids)
    for mid in ids:
        r = row(mid)
        assert r["status"] == "ACCEPTED" and r["attempts"] == 1
        assert r["sent_at"] is not None and r["provider_message_id"].startswith("<")
        assert r["claimed_by"] is None and r["last_error"] is None
    assert len(list((tmp_path / "outbox").glob("*.eml"))) == len(ids)
    eml = next((tmp_path / "outbox").glob("*.eml")).read_text(encoding="utf-8", errors="replace")
    assert "multipart/alternative" in eml and "text/html" in eml and "Auto-Submitted: auto-generated" in eml


def test_transient_failures_back_off_then_fail_after_max_attempts(tmp_path, enqueue):
    mid = enqueue("EXPIRED")
    t = Flaky(TransientError("timeout"), TransientError("timeout"), TransientError("451 try later"))
    w = Worker(cfg(tmp_path), transport=t)

    run_for(w, [mid])
    r = row(mid)
    assert r["status"] == "RETRYING" and r["attempts"] == 1 and r["last_error"] == "timeout"
    assert r["next_attempt_at"] > dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=50)  # 60s * 2^0
    run_for(w, [mid])  # not due yet: nothing happens
    assert row(mid)["attempts"] == 1

    with psycopg.connect(TEST_DB, autocommit=True) as c:
        c.execute("update admit_email_messages set next_attempt_at = now() - interval '1 second' where id = %s", (mid,))
    run_for(w, [mid])
    r = row(mid)
    assert r["status"] == "RETRYING" and r["attempts"] == 2
    assert r["next_attempt_at"] > dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=100)  # 60s * 2^1

    with psycopg.connect(TEST_DB, autocommit=True) as c:
        c.execute("update admit_email_messages set next_attempt_at = now() - interval '1 second' where id = %s", (mid,))
    run_for(w, [mid])
    r = row(mid)
    assert r["status"] == "FAILED" and r["attempts"] == 3 and "451" in r["last_error"]


def test_a_retry_that_succeeds_ends_accepted_and_clears_the_error(tmp_path, enqueue):
    mid = enqueue("MAGIC_LINK")
    w = Worker(cfg(tmp_path), transport=Flaky(TransientError("boom")))
    run_for(w, [mid])
    assert row(mid)["status"] == "RETRYING"
    with psycopg.connect(TEST_DB, autocommit=True) as c:
        c.execute("update admit_email_messages set next_attempt_at = now() - interval '1 second' where id = %s", (mid,))
    run_for(w, [mid])
    r = row(mid)
    assert r["status"] == "ACCEPTED" and r["attempts"] == 2 and r["last_error"] is None


def test_permanent_failure_is_final_immediately(tmp_path, enqueue):
    mid = enqueue("EXPIRED")
    run_for(Worker(cfg(tmp_path), transport=Flaky(PermanentError("recipient refused"))), [mid])
    r = row(mid)
    assert r["status"] == "FAILED" and r["attempts"] == 1 and r["last_error"] == "recipient refused"


def test_a_malformed_payload_fails_without_sending(tmp_path, enqueue):
    bad = sample("TICKETS")
    del bad["tickets"]
    mid = enqueue("TICKETS", bad)
    t = Flaky()
    run_for(Worker(cfg(tmp_path), transport=t), [mid])
    r = row(mid)
    assert r["status"] == "FAILED" and "render" in r["last_error"] and t.sent == []


def test_two_workers_never_claim_the_same_message(tmp_path, enqueue):
    ids = [enqueue("EXPIRED") for _ in range(30)]
    got: list[list[str]] = []

    def take(name):
        ob = Outbox(TEST_DB, name, 300, 60)
        got.append([m.id for m in ob.claim(100) if m.id in ids])
        ob.close()

    threads = [threading.Thread(target=take, args=(f"w{i}",)) for i in range(4)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    flat = [i for g in got for i in g]
    assert len(flat) == len(set(flat)) == 30


def test_a_live_lease_blocks_claims_but_a_stale_one_is_taken_over(tmp_path, enqueue):
    fresh = enqueue("EXPIRED", claimed_by="other-worker", claimed_at=dt.datetime.now(dt.timezone.utc))
    stale = enqueue("EXPIRED", claimed_by="crashed-worker", claimed_at=dt.datetime.now(dt.timezone.utc) - dt.timedelta(minutes=10))
    ob = Outbox(TEST_DB, "me", 300, 60)
    claimed = {m.id for m in ob.claim(500)}
    ob.close()
    assert stale in claimed and fresh not in claimed
    assert row(stale)["claimed_by"] == "me"


def test_a_worker_that_lost_its_lease_cannot_overwrite_the_newer_outcome(tmp_path, enqueue):
    mid = enqueue("EXPIRED")
    slow = Outbox(TEST_DB, "slow", 300, 60)
    msg = next(m for m in slow.claim(500) if m.id == mid)
    with psycopg.connect(TEST_DB, autocommit=True) as c:  # another worker took the message over and finished it
        c.execute("update admit_email_messages set claimed_by = 'fast', status = 'ACCEPTED' where id = %s", (mid,))
    assert slow.accepted(msg, "<late@test>") is False
    assert slow.failed(msg, "late failure") is False
    slow.close()
    r = row(mid)
    assert r["status"] == "ACCEPTED" and r["provider_message_id"] is None


def test_the_worker_only_ever_writes_the_email_table(tmp_path, enqueue):
    """The delivery outcome never reaches bookings or tickets: a FAILED email leaves them exactly as they were."""
    with psycopg.connect(TEST_DB, autocommit=True) as c:
        before = c.execute("select (select count(*) from admit_bookings), (select count(*) from admit_tickets)").fetchone()
    mid = enqueue("TICKETS")
    run_for(Worker(cfg(tmp_path), transport=Flaky(PermanentError("mailbox full"))), [mid])
    assert row(mid)["status"] == "FAILED"
    with psycopg.connect(TEST_DB, autocommit=True) as c:
        assert c.execute("select (select count(*) from admit_bookings), (select count(*) from admit_tickets)").fetchone() == before


def test_real_payloads_from_the_api_render(tmp_path):
    """Contract check: whatever the NestJS composer queued during its integration tests must render."""
    from admit_worker.render import render

    with psycopg.connect(TEST_DB, row_factory=psycopg.rows.dict_row) as c:
        rows = c.execute("select distinct on (type) type, payload from admit_email_messages where organization_id not like 'org_test_%%' order by type, created_at desc").fetchall()
    for r in rows:
        subject, html, text = render(r["type"], r["payload"])
        assert subject and "{{" not in html and text


PNG = bytes.fromhex("89504e470d0a1a0a") + bytes(40)


def _only_eml(tmp_path):
    import email
    from email import policy

    files = list((tmp_path / "outbox").glob("*.eml"))
    assert len(files) == 1
    return email.message_from_bytes(files[0].read_bytes(), policy=policy.default)


def test_ticket_qr_images_travel_inside_the_email(tmp_path, enqueue):
    mid = enqueue("TICKETS")
    run_for(Worker(cfg(tmp_path), fetch_image=lambda url: PNG), [mid])
    assert row(mid)["status"] == "ACCEPTED"
    msg = _only_eml(tmp_path)
    html = msg.get_body(("html",)).get_content()
    # the remote links are gone, replaced by cid: references that resolve to attached PNGs (one per ticket)
    assert "https://api.example/qr/" not in html
    cids = [p["Content-ID"].strip("<>") for p in msg.walk() if p.get_content_type() == "image/png"]
    assert len(cids) == 2
    for cid in cids:
        assert f"cid:{cid}" in html
    assert any(p.get_content_type() == "multipart/related" for p in msg.walk())


def test_a_failed_qr_download_keeps_the_remote_link(tmp_path, enqueue):
    mid = enqueue("TICKETS")
    run_for(Worker(cfg(tmp_path), fetch_image=lambda url: None), [mid])
    assert row(mid)["status"] == "ACCEPTED"  # the ticket email is never held back by an image
    msg = _only_eml(tmp_path)
    html = msg.get_body(("html",)).get_content()
    assert "https://api.example/qr/1.png?k=abc" in html and "https://api.example/qr/2.png?k=abc" in html
    assert not [p for p in msg.walk() if p.get_content_type() == "image/png"]
