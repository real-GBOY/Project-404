"""Turns an outbox payload into a subject, an HTML body and a plain-text body.

The payload was decided entirely by the API (names, dates already formatted in the organizer's time zone, money already
formatted, QR image URLs, links). Rendering only places those values into the approved templates: nothing here computes a
total, looks up a booking or chooses who gets what.
"""

from __future__ import annotations

import re
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

from jinja2 import Environment, FileSystemLoader, StrictUndefined, TemplateError, select_autoescape

TEMPLATES = Path(__file__).parent / "templates"

SUBJECTS: dict[str, str] = {
    "INSTRUCTIONS": "Complete your payment - {event_name}",
    "PROOF_RECEIVED": "We received your payment proof - {event_name}",
    "TICKETS": "Your ticket is confirmed - {event_name}",
    "REJECTED": "Action needed: we couldn't verify your payment - {event_name}",
    "EXPIRED": "Your booking has expired - {event_name}",
    "CANCELLED": "Your booking was cancelled - {event_name}",
    "MAGIC_LINK": "Your tickets link - {event_name}",
}

TEMPLATE_FILES: dict[str, str] = {
    "INSTRUCTIONS": "instructions.html.j2",
    "PROOF_RECEIVED": "proof-received.html.j2",
    "TICKETS": "ticket-confirmed.html.j2",
    "REJECTED": "rejected.html.j2",
    "EXPIRED": "expired.html.j2",
    "CANCELLED": "cancelled.html.j2",
    "MAGIC_LINK": "magic-link.html.j2",
}

#: Keys every email needs. A payload missing one is a bug on the API side: it fails permanently instead of sending a broken email.
COMMON_REQUIRED = ("organizer_name", "booking_reference", "customer_name", "event_name", "status_url")
REQUIRED: dict[str, tuple[str, ...]] = {
    "INSTRUCTIONS": ("total", "hold_expires", "items", "payment_methods", "upload_url"),
    "PROOF_RECEIVED": (),
    "TICKETS": ("tickets", "ticket_count", "ticket_page_url", "event_date", "event_time", "event_venue"),
    "REJECTED": ("rejection_reason", "can_resubmit", "upload_url"),
    "EXPIRED": (),
    "CANCELLED": (),
    "MAGIC_LINK": ("ticket_page_url",),
}


class RenderError(Exception):
    """The payload cannot be rendered. Permanent: retrying the same payload will fail the same way."""


_env = Environment(
    loader=FileSystemLoader(str(TEMPLATES)),
    autoescape=select_autoescape(["html", "j2"], default=True),
    undefined=StrictUndefined,
    trim_blocks=True,
    lstrip_blocks=True,
)


class _Text(HTMLParser):
    """HTML -> readable plain text for the multipart/alternative fallback (links kept as 'label (url)')."""

    BLOCK = {"p", "div", "tr", "br", "h1", "h2", "h3", "li", "table"}

    def __init__(self) -> None:
        super().__init__()
        self.out: list[str] = []
        self._href: str | None = None
        self._skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in ("style", "script", "head"):
            self._skip += 1
        if tag == "a":
            self._href = dict(attrs).get("href")
        if tag == "img":
            alt = dict(attrs).get("alt")
            if alt:
                self.out.append(f"[{alt}]")
        if tag in self.BLOCK:
            self.out.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("style", "script", "head"):
            self._skip = max(self._skip - 1, 0)
        if tag == "a" and self._href and self._href.startswith("http"):
            self.out.append(f" ({self._href})")
            self._href = None
        if tag in self.BLOCK:
            self.out.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skip and data.strip():
            self.out.append(re.sub(r"\s+", " ", data))


def html_to_text(html: str) -> str:
    p = _Text()
    p.feed(html)
    text = "".join(p.out)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip() + "\n"


def render(mail_type: str, payload: dict[str, Any]) -> tuple[str, str, str]:
    if mail_type not in TEMPLATE_FILES:
        raise RenderError(f"unknown email type {mail_type!r}")
    missing = [k for k in (*COMMON_REQUIRED, *REQUIRED[mail_type]) if k not in payload]
    if missing:
        raise RenderError(f"payload is missing {', '.join(missing)}")
    # Optional keys get a safe default so the templates can stay strict about everything else.
    ctx: dict[str, Any] = {
        "support_email": "", "brand_logo_url": "", "event_image_url": "", "event_address": "", "event_map_url": "", "policy_summary": "",
        "event_date": "", "event_time": "", "event_venue": "", "ticket_page_url": "", "upload_url": "", **payload,
    }
    try:
        subject = SUBJECTS[mail_type].format(event_name=ctx["event_name"])
        html = _env.get_template(TEMPLATE_FILES[mail_type]).render(**ctx)
    except (TemplateError, KeyError, TypeError) as exc:
        raise RenderError(str(exc)) from exc
    return subject, html, html_to_text(html)
