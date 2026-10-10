"""The delivery loop."""

from __future__ import annotations

import logging
import signal
import threading
from typing import Protocol

import psycopg

from .config import Config
from .images import Fetcher, fetch_png, inline_qr_images
from .outbox import Message, Outbox
from .render import RenderError, render
from .transport import LogTransport, PermanentError, SmtpTransport, TransientError, build_message

log = logging.getLogger("admit.worker")


class Transport(Protocol):
    def send(self, msg) -> str: ...


def make_transport(cfg: Config) -> Transport:
    return SmtpTransport(cfg.smtp_url) if cfg.transport == "smtp" else LogTransport(cfg.outbox_dir)


class Worker:
    """Claims due messages, renders and sends each, and records the outcome. It decides nothing about bookings or tickets:
    a message that cannot be sent ends up FAILED where staff can see it and retry it; the booking and its tickets are untouched."""

    def __init__(
        self, cfg: Config, outbox: Outbox | None = None, transport: Transport | None = None, fetch_image: Fetcher | None = None
    ) -> None:
        self.cfg = cfg
        self.fetch_image = fetch_image or fetch_png
        self.outbox = outbox or Outbox(cfg.database_url, cfg.worker_id, cfg.lease_seconds, cfg.backoff_base)
        self.transport = transport or make_transport(cfg)
        self._stop = threading.Event()

    def process(self, m: Message) -> str:
        """Deliver one claimed message. Returns the outcome: accepted | retrying | failed | lost (lease taken over)."""
        try:
            subject, html, text = render(m.type, m.payload)
        except RenderError as exc:
            log.error("render failed for %s (%s): %s", m.id, m.type, exc)
            return "failed" if self.outbox.failed(m, f"render: {exc}") else "lost"
        html, inline = inline_qr_images(html, m.payload, self.fetch_image)
        msg = build_message(self.cfg.mail_from, m.to_email, subject, html, text, reply_to=str(m.payload.get("support_email") or ""), inline_images=inline)
        try:
            provider_id = self.transport.send(msg)
        except PermanentError as exc:
            log.warning("permanent failure for %s: %s", m.id, exc)
            return "failed" if self.outbox.failed(m, str(exc)) else "lost"
        except TransientError as exc:
            log.warning("transient failure for %s (attempt %d/%d): %s", m.id, m.attempts + 1, m.max_attempts, exc)
            ok = self.outbox.retry_later(m, str(exc))
            return ("failed" if m.attempts + 1 >= m.max_attempts else "retrying") if ok else "lost"
        if not self.outbox.accepted(m, provider_id):
            # Sent, but our lease had been taken over: another attempt may also send. Rare (needs a stall longer than the lease); logged loudly.
            log.error("message %s was sent but its lease was lost; a duplicate is possible", m.id)
            return "lost"
        log.info("accepted %s (%s) -> %s", m.id, m.type, m.to_email)
        return "accepted"

    def run_once(self) -> int:
        batch = self.outbox.claim(self.cfg.batch_size)
        for m in batch:
            self.process(m)
        return len(batch)

    def run_forever(self) -> None:
        log.info("admit worker %s started (transport=%s, batch=%d, poll=%.1fs)", self.cfg.worker_id, self.cfg.transport, self.cfg.batch_size, self.cfg.poll_interval)
        while not self._stop.is_set():
            try:
                n = self.run_once()
            except psycopg.Error as exc:
                log.error("database error, will retry: %s", exc)
                n = 0
            if n == 0:
                self._stop.wait(self.cfg.poll_interval)
        self.outbox.close()
        log.info("admit worker stopped")

    def stop(self) -> None:
        self._stop.set()

    def install_signal_handlers(self) -> None:
        for sig in (signal.SIGINT, signal.SIGTERM):
            signal.signal(sig, lambda *_: self.stop())
