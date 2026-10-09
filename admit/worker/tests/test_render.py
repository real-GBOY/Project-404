from __future__ import annotations

import re

import pytest

from admit_worker.render import RenderError, SUBJECTS, render
from conftest import SAMPLES, sample


@pytest.mark.parametrize("kind", sorted(SAMPLES))
def test_every_type_renders_without_leftover_placeholders(kind):
    subject, html, text = render(kind, sample(kind))
    assert "Cairo Jazz Nights" in subject
    assert "{{" not in html and "{%" not in html
    assert "Nour Hassan" in text
    assert "Nile Sessions Events" in text  # footer: organizer name
    assert "ADM-7K4Q2931" in html


def test_ticket_email_has_one_block_and_one_qr_per_ticket():
    _, html, text = render("TICKETS", sample("TICKETS"))
    assert html.count("QR code for ticket") == 2
    assert "https://api.example/qr/1.png?k=abc" in html and "https://api.example/qr/2.png?k=abc" in html
    assert "Ticket 1 of 2" in html and "Ticket 2 of 2" in html
    # a missing holder name falls back to the booking owner
    assert html.count("Nour Hassan") >= 3
    assert "Payment verified" in html
    # the plain-text part carries the same facts
    assert "Ticket 1 of 2" in text and "tix_AAA" in text


def test_only_the_approved_email_contains_tickets():
    for kind in SAMPLES:
        _, html, _ = render(kind, sample(kind))
        assert ("QR code for ticket" in html) == (kind == "TICKETS")


def test_values_are_html_escaped():
    _, html, _ = render("REJECTED", sample("REJECTED"))
    assert "&lt;b&gt;" in html and "<b>." not in html


def test_rejected_without_resubmission_has_no_upload_button():
    _, html, _ = render("REJECTED", sample("REJECTED", can_resubmit=False))
    assert "Upload new proof" not in html and "contact the organizer" in html.lower()


def test_instructions_lists_every_method_and_the_total():
    _, html, text = render("INSTRUCTIONS", sample("INSTRUCTIONS"))
    assert "nile@instapay" in html and "EGP 1,650.00" in text and "2 &times; General admission" in html or "2 × General admission" in html
    assert "This email is not a ticket" in text


def test_event_image_row_is_omitted_when_there_is_no_image():
    _, with_img, _ = render("TICKETS", sample("TICKETS", event_image_url="https://cdn.example/e.jpg"))
    _, without, _ = render("TICKETS", sample("TICKETS"))
    assert "https://cdn.example/e.jpg" in with_img and "e.jpg" not in without
    assert "border-top:2px solid #16140F" in without  # the info card takes the ink top border instead


def test_missing_required_fields_are_a_permanent_render_error():
    payload = sample("TICKETS")
    del payload["tickets"]
    with pytest.raises(RenderError, match="tickets"):
        render("TICKETS", payload)
    with pytest.raises(RenderError):
        render("NOPE", sample("EXPIRED"))


def test_subjects_have_no_unfilled_format_fields():
    for kind, s in SUBJECTS.items():
        assert not re.search(r"\{(?!event_name\})", s)
