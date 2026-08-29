from datetime import date, timedelta
import pytest
from services.reminders import (
    build_whatsapp_renewal_message,
    resolve_client_renewal_date,
    generate_owner_digest_text,
)


def test_resolve_client_renewal_date_from_next_renewal():
    client = {
        "full_name": "Priya Sharma",
        "next_renewal_date": "2026-09-05",
    }
    resolved = resolve_client_renewal_date(client)
    assert resolved == date(2026, 9, 5)


def test_resolve_client_renewal_date_fallback_join_date():
    client = {
        "full_name": "Amit Patel",
        "join_date": "2026-08-01",
    }
    resolved = resolve_client_renewal_date(client)
    assert resolved == date(2026, 8, 31)


def test_build_whatsapp_renewal_message_upcoming():
    client = {
        "full_name": "Priya Sharma",
        "plan_name": "1 Month Plan",
    }
    msg = build_whatsapp_renewal_message(client, "2026-09-02", 3)
    assert "Priya Sharma" in msg
    assert "1 Month Plan" in msg
    assert "expire in 3 days" in msg
    assert "2026-09-02" in msg


def test_build_whatsapp_renewal_message_today():
    client = {
        "full_name": "Rahul Verma",
        "plan_name": "3 Months Plan",
    }
    msg = build_whatsapp_renewal_message(client, "2026-08-29", 0)
    assert "Rahul Verma" in msg
    assert "expires *today*" in msg


def test_build_whatsapp_renewal_message_expired():
    client = {
        "full_name": "Sneha Patel",
        "plan_name": "6 Months Plan",
    }
    msg = build_whatsapp_renewal_message(client, "2026-08-25", -4)
    assert "Sneha Patel" in msg
    assert "expired on *2026-08-25*" in msg
    assert "4 days ago" in msg


def test_generate_owner_digest_text():
    today = date(2026, 8, 29)
    expiries = {
        "expiring_today": [
            {"full_name": "Rahul Verma", "batch_name": "Morning Batch", "plan_name": "1 Month Plan"}
        ],
        "expiring_soon": [
            {"full_name": "Priya Sharma", "batch_name": "Ladies Batch", "days_diff": 3, "renewal_date": "2026-09-01"}
        ],
        "expired": [
            {"full_name": "Sneha Patel", "batch_name": "Evening Batch", "days_diff": -2, "renewal_date": "2026-08-27"}
        ],
    }
    digest = generate_owner_digest_text(expiries, today)
    assert "Daily Plan Expiry Digest" in digest
    assert "Rahul Verma" in digest
    assert "Priya Sharma" in digest
    assert "Sneha Patel" in digest
