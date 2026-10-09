"""Worker configuration, read from the environment (a `.env` file next to the worker is loaded first if present)."""

from __future__ import annotations

import os
import socket
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv(path: Path) -> None:
    """Minimal .env loader: KEY=VALUE lines, no overriding of variables already set."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


@dataclass(frozen=True)
class Config:
    #: Connects as the `auric_system` role (BYPASSRLS): the worker serves every organizer. It only ever touches admit_email_messages.
    database_url: str
    #: "smtp" delivers over SMTP; "log" writes each message to `outbox_dir` as an .eml file (development / demos).
    transport: str
    smtp_url: str
    mail_from: str
    outbox_dir: Path
    poll_interval: float
    batch_size: int
    #: A claim older than this is considered abandoned (the worker crashed) and the message becomes claimable again.
    lease_seconds: int
    #: Seconds before retry k (1-based): backoff_base * 2**(k-1).
    backoff_base: int
    worker_id: str

    @staticmethod
    def from_env() -> "Config":
        _load_dotenv(Path.cwd() / ".env")
        transport = os.environ.get("ADMIT_WORKER_TRANSPORT", "log").strip().lower()
        if transport not in ("smtp", "log"):
            raise ValueError("ADMIT_WORKER_TRANSPORT must be 'smtp' or 'log'")
        smtp_url = os.environ.get("ADMIT_WORKER_SMTP_URL", "").strip()
        if transport == "smtp" and not smtp_url:
            raise ValueError("ADMIT_WORKER_SMTP_URL is required when ADMIT_WORKER_TRANSPORT=smtp")
        database_url = os.environ.get("ADMIT_WORKER_DATABASE_URL", "").strip()
        if not database_url:
            raise ValueError("ADMIT_WORKER_DATABASE_URL is required (the auric_system role of the Admit database)")
        return Config(
            database_url=database_url,
            transport=transport,
            smtp_url=smtp_url,
            mail_from=os.environ.get("ADMIT_WORKER_MAIL_FROM", "Admit <tickets@admit.example>").strip(),
            outbox_dir=Path(os.environ.get("ADMIT_WORKER_OUTBOX_DIR", "./outbox")),
            poll_interval=float(os.environ.get("ADMIT_WORKER_POLL_SECONDS", "2")),
            batch_size=int(os.environ.get("ADMIT_WORKER_BATCH_SIZE", "10")),
            lease_seconds=int(os.environ.get("ADMIT_WORKER_LEASE_SECONDS", "300")),
            backoff_base=int(os.environ.get("ADMIT_WORKER_BACKOFF_SECONDS", "60")),
            worker_id=os.environ.get("ADMIT_WORKER_ID", f"{socket.gethostname()}-{os.getpid()}"),
        )
