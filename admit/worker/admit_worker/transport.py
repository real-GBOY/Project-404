"""Sending. Two transports: SMTP, and a log transport that writes .eml files (development, demos, tests)."""

from __future__ import annotations

import smtplib
import ssl
import uuid
from email.message import EmailMessage
from email.utils import formataddr, make_msgid, parseaddr
from pathlib import Path
from urllib.parse import unquote, urlparse


class TransientError(Exception):
    """Worth retrying: network trouble, a 4xx reply, a busy server."""


class PermanentError(Exception):
    """Retrying cannot help: the address was refused outright, or the server rejected the message for good."""


def build_message(mail_from: str, to: str, subject: str, html: str, text: str, reply_to: str = "") -> EmailMessage:
    msg = EmailMessage()
    name, addr = parseaddr(mail_from)
    msg["From"] = formataddr((name, addr)) if name else addr
    msg["To"] = to
    msg["Subject"] = subject
    msg["Message-ID"] = make_msgid(domain=addr.split("@")[-1] or "admit.local")
    msg["Auto-Submitted"] = "auto-generated"
    if reply_to:
        msg["Reply-To"] = reply_to
    msg.set_content(text)
    msg.add_alternative(html, subtype="html")
    return msg


class LogTransport:
    """Writes each message to `<dir>/<timestamp>-<id>.eml`. 'Accepted' means 'written'."""

    def __init__(self, directory: Path) -> None:
        self.directory = directory

    def send(self, msg: EmailMessage) -> str:
        self.directory.mkdir(parents=True, exist_ok=True)
        path = self.directory / f"{uuid.uuid4().hex}.eml"
        path.write_bytes(bytes(msg))
        return str(msg["Message-ID"])


class SmtpTransport:
    """smtp://user:pass@host:587 (STARTTLS when offered) or smtps://user:pass@host:465 (implicit TLS)."""

    def __init__(self, url: str) -> None:
        u = urlparse(url)
        if u.scheme not in ("smtp", "smtps") or not u.hostname:
            raise ValueError("ADMIT_WORKER_SMTP_URL must look like smtp://user:pass@host:587 or smtps://user:pass@host:465")
        self.secure = u.scheme == "smtps"
        self.host = u.hostname
        self.port = u.port or (465 if self.secure else 587)
        self.user = unquote(u.username) if u.username else ""
        self.password = unquote(u.password) if u.password else ""

    def send(self, msg: EmailMessage) -> str:
        try:
            ctx = ssl.create_default_context()
            client: smtplib.SMTP = smtplib.SMTP_SSL(self.host, self.port, timeout=30, context=ctx) if self.secure else smtplib.SMTP(self.host, self.port, timeout=30)
            with client:
                client.ehlo()
                if not self.secure and client.has_extn("starttls"):
                    client.starttls(context=ctx)
                    client.ehlo()
                if self.user:
                    client.login(self.user, self.password)
                refused = client.send_message(msg)
        except smtplib.SMTPRecipientsRefused as exc:
            raise PermanentError(f"recipient refused: {exc.recipients}") from exc
        except smtplib.SMTPResponseException as exc:
            # 5xx = the server said no for good; 4xx = try later
            raise (PermanentError if 500 <= exc.smtp_code < 600 else TransientError)(f"SMTP {exc.smtp_code} {exc.smtp_error!r}") from exc
        except (smtplib.SMTPException, OSError, TimeoutError) as exc:
            raise TransientError(f"{type(exc).__name__}: {exc}") from exc
        if refused:
            raise PermanentError(f"recipient refused: {refused}")
        return str(msg["Message-ID"])
