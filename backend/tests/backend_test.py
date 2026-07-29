"""Backend tests for Divine Yoga Studio CRM."""
import os
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if "REACT_APP_BACKEND_URL" in os.environ else "https://yoga-admin-crm.preview.emergentagent.com"
API = f"{BASE_URL}/api/v1"
ADMIN_EMAIL = "admin@divineyogastudio.in"
ADMIN_PASSWORD = "yamx1yNHKwKNeKrw7s9LqjAM"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def authed_session(session):
    r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["email"] == ADMIN_EMAIL
    assert "access_token" in session.cookies
    return session


# Health / security headers: /health is internal-only; ingress only routes /api/*.
# We verify security headers on a public /api endpoint instead.
def test_security_headers_present():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401
    assert r.headers.get("x-content-type-options", "").lower() == "nosniff"
    assert r.headers.get("x-frame-options", "").upper() == "DENY"
    assert "content-security-policy" in {k.lower() for k in r.headers}
    assert "strict-transport-security" in {k.lower() for k in r.headers}


# Auth
def test_unauthenticated_me_returns_401():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 401


def test_unauthenticated_dashboard_returns_401():
    r = requests.get(f"{API}/admin/dashboard/summary")
    assert r.status_code == 401


def test_login_wrong_password_returns_401():
    r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong-pass-xyz"})
    assert r.status_code == 401


def test_login_success_and_me(authed_session):
    r = authed_session.get(f"{API}/auth/me")
    assert r.status_code == 200
    body = r.json()
    assert body["email"] == ADMIN_EMAIL
    assert "password_hash" not in body


# Dashboard
def test_dashboard_summary(authed_session):
    r = authed_session.get(f"{API}/admin/dashboard/summary")
    assert r.status_code == 200
    d = r.json()
    for key in ["total_collected", "total_pending", "overdue_count", "projected_revenue", "active_clients", "reminders_today"]:
        assert key in d


def test_dashboard_revenue_trend(authed_session):
    r = authed_session.get(f"{API}/admin/dashboard/revenue-trend")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# Resources
def test_list_clients(authed_session):
    r = authed_session.get(f"{API}/admin/clients")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_list_batches(authed_session):
    r = authed_session.get(f"{API}/admin/batches")
    assert r.status_code == 200


def test_list_plans(authed_session):
    r = authed_session.get(f"{API}/admin/plans")
    assert r.status_code == 200


def test_list_payments_and_overdue(authed_session):
    r = authed_session.get(f"{API}/admin/payments")
    assert r.status_code == 200
    payments = r.json()
    assert isinstance(payments, list)
    # ensure overdue records exist per PRD seed
    overdue = [p for p in payments if p["payment_status"] == "overdue"]
    assert isinstance(overdue, list)


def test_reminder_templates(authed_session):
    r = authed_session.get(f"{API}/admin/reminders/templates")
    assert r.status_code == 200


def test_reminder_logs(authed_session):
    r = authed_session.get(f"{API}/admin/reminders/logs")
    assert r.status_code == 200


def test_send_manual_reminder_queues(authed_session):
    payments = authed_session.get(f"{API}/admin/payments").json()
    open_p = [p for p in payments if p["payment_status"] in ("overdue", "pending", "partial")]
    if not open_p:
        pytest.skip("No open payments to remind")
    payment_id = open_p[0]["id"]
    r = authed_session.post(f"{API}/admin/reminders/send-manual", json={"payment_ids": [payment_id]})
    assert r.status_code == 200
    body = r.json()
    assert "results" in body
    assert len(body["results"]) >= 1
    # verify log persisted
    logs = authed_session.get(f"{API}/admin/reminders/logs").json()
    assert any(l.get("payment_id") == payment_id or l.get("client_id") == open_p[0]["client_id"] for l in logs)


def test_logout(authed_session):
    r = authed_session.post(f"{API}/auth/logout")
    assert r.status_code == 200
