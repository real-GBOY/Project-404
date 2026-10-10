"""Inline images. Mail clients hide remote images until the reader clicks "display images" (and some never load them), and the ticket QR
is the one image the email cannot do without. So the worker downloads each ticket's QR PNG from the API at send time and attaches it inside
the message (Content-ID); if the download fails the email still goes out with the original remote link, which is what it had before."""

from __future__ import annotations

import html as htmllib
import logging
import urllib.request
from typing import Callable
from urllib.parse import urlparse

log = logging.getLogger("admit.worker")

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
MAX_BYTES = 512 * 1024

Fetcher = Callable[[str], "bytes | None"]


def fetch_png(url: str) -> bytes | None:
    """GET a PNG over http(s). None for anything else: a non-PNG answer, an oversize body, any network trouble."""
    if urlparse(url).scheme not in ("http", "https"):
        return None
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "admit-worker"})
        with urllib.request.urlopen(req, timeout=10) as res:  # noqa: S310 - the URL is composed by our own API
            data = res.read(MAX_BYTES + 1)
    except Exception as exc:  # noqa: BLE001 - any failure just means "keep the remote link"
        log.warning("could not fetch %s for inlining: %s", url.split("?")[0], exc)
        return None
    if len(data) > MAX_BYTES or not data.startswith(PNG_MAGIC):
        return None
    return data


def inline_qr_images(html: str, payload: dict, fetch: Fetcher) -> tuple[str, list[tuple[str, bytes]]]:
    """Swap each ticket's QR URL in the HTML for a cid: reference. Returns the new HTML and the (content-id, bytes) images to attach."""
    images: list[tuple[str, bytes]] = []
    for n, ticket in enumerate(payload.get("tickets") or [], start=1):
        url = ticket.get("ticket_qr_code_url") if isinstance(ticket, dict) else None
        if not url:
            continue
        # the template autoescapes, so the URL may appear escaped in the markup
        spelled = [s for s in (url, htmllib.escape(url, quote=True), htmllib.escape(url, quote=False)) if s in html]
        if not spelled:
            continue
        data = fetch(url)
        if not data:
            continue
        cid = f"qr{n}.{abs(hash(url)) % 10**8}@admit"
        for s in spelled:
            html = html.replace(s, f"cid:{cid}")
        images.append((cid, data))
    return html, images
