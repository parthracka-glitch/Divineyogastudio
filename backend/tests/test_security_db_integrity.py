"""Integration tests for security hardening, database integrity, and system health."""
import os
import pytest
from fastapi.testclient import TestClient

from server import app

client = TestClient(app)

ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@divineyogastudio.in")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "yamx1yNHKwKNeKrw7s9LqjAM")


@pytest.fixture(scope="module")
def authed_client():
    resp = client.post(
        "/api/v1/auth/login",
        json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD},
    )
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    return TestClient(app, cookies=resp.cookies, headers=headers)



def test_health_check_returns_healthy():
    resp = client.get("/health")
    assert resp.status_code == 200, f"Health check failed: {resp.text}"
    data = resp.json()

    assert data["status"] == "healthy"
    assert data["database"]["connected"] is True
    assert "latency_ms" in data["database"]
    assert "scheduler" in data


def test_security_headers_enforced():
    resp = client.get("/")
    assert resp.status_code == 200
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert "Strict-Transport-Security" in resp.headers
    assert "Content-Security-Policy" in resp.headers


def test_unauthenticated_protected_routes_blocked():
    resp = client.get("/api/v1/admin/dashboard/summary")
    assert resp.status_code == 401


def test_database_reset_endpoint_strictly_guarded(authed_client):
    # Without ALLOW_DANGEROUS_RESET=true, it MUST return 403 Forbidden
    os.environ.pop("ALLOW_DANGEROUS_RESET", None)
    resp = authed_client.post("/api/v1/admin/reset-database", json={})
    assert resp.status_code == 403
    assert "permanently disabled" in resp.json()["detail"].lower()


def test_database_reset_confirmation_phrase_required(authed_client, monkeypatch):
    monkeypatch.setenv("ALLOW_DANGEROUS_RESET", "true")
    # Wrong or missing confirmation phrase must return 400 Bad Request
    resp = authed_client.post("/api/v1/admin/reset-database", json={"confirm_phrase": "wrong"})
    assert resp.status_code == 400
    assert "confirmation phrase" in resp.json()["detail"].lower()


def test_database_backup_export(authed_client):
    resp = authed_client.get("/api/v1/admin/database/backup")
    assert resp.status_code == 200
    assert "attachment; filename=divine-yoga-backup" in resp.headers.get("Content-Disposition", "")
    data = resp.json()
    assert data["studio"] == "Divine Yoga Studio"
    assert "collections" in data
    assert "clients" in data["collections"]
    assert "payments" in data["collections"]


def test_client_search_redos_safe(authed_client):
    # Special regex metacharacters should not trigger server errors or ReDoS
    malicious_inputs = ["(", "*+", "(.*)+"]
    for q in malicious_inputs:
        resp = authed_client.get("/api/v1/admin/clients", params={"search": q})
        assert resp.status_code == 200, f"Failed on regex search input: {q}"



def test_batch_deletion_referential_integrity(authed_client):
    import uuid
    unique_suffix = uuid.uuid4().hex[:6]
    # 1. Create a test batch
    b_resp = authed_client.post("/api/v1/admin/batches", json={
        "name": f"Integrity Batch {unique_suffix}",
        "category_tag": "Test",
        "description": "Batch integrity check",
        "instructor_name": "Instructor Test",
        "schedule_days": ["Mon"],
        "start_time": "06:00",
        "end_time": "07:00",
        "capacity": 10,
        "is_active": True,
    })
    assert b_resp.status_code == 200, b_resp.text
    batch_id = b_resp.json()["id"]

    # 2. Create an active client in this batch
    c_resp = authed_client.post("/api/v1/admin/clients", json={
        "full_name": f"Batch Client {unique_suffix}",
        "phone_number": f"+9198{uuid.uuid4().int % 100000000:08d}",
        "batch_id": batch_id,
        "join_date": "2026-09-01",
        "status": "active",
    })
    assert c_resp.status_code == 200, c_resp.text
    client_id = c_resp.json()["id"]

    try:
        # 3. Attempt to delete batch with active client - MUST return 400 Bad Request
        del_resp = authed_client.delete(f"/api/v1/admin/batches/{batch_id}")
        assert del_resp.status_code == 400
        assert "cannot delete batch" in del_resp.json()["detail"].lower()
    finally:
        # Cleanup
        authed_client.delete(f"/api/v1/admin/clients/{client_id}")
        # Once client is soft-deleted, deleting the batch works:
        del_ok = authed_client.delete(f"/api/v1/admin/batches/{batch_id}")
        assert del_ok.status_code == 200


def test_plan_deletion_referential_integrity(authed_client):
    import uuid
    unique_suffix = uuid.uuid4().hex[:6]
    # 1. Create a test membership plan
    p_resp = authed_client.post("/api/v1/admin/plans", json={
        "name": f"Integrity Plan {unique_suffix}",
        "plan_type": "monthly",
        "amount": 2500,
        "duration_days": 30,
        "is_active": True,
    })
    assert p_resp.status_code == 200, p_resp.text
    plan_id = p_resp.json()["id"]

    # 2. Create an active client referencing this plan
    c_resp = authed_client.post("/api/v1/admin/clients", json={
        "full_name": f"Plan Client {unique_suffix}",
        "phone_number": f"+9197{uuid.uuid4().int % 100000000:08d}",
        "plan_id": plan_id,
        "join_date": "2026-09-01",
        "status": "active",
    })
    assert c_resp.status_code == 200, c_resp.text
    client_id = c_resp.json()["id"]

    try:
        # 3. Attempt to delete plan with active client - MUST return 400 Bad Request
        del_resp = authed_client.delete(f"/api/v1/admin/plans/{plan_id}")
        assert del_resp.status_code == 400
        assert "cannot delete membership plan" in del_resp.json()["detail"].lower()
    finally:
        # Cleanup
        authed_client.delete(f"/api/v1/admin/clients/{client_id}")
        # Once client is deleted, plan deletion succeeds
        del_ok = authed_client.delete(f"/api/v1/admin/plans/{plan_id}")
        assert del_ok.status_code == 200

