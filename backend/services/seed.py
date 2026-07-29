import os
import uuid
from datetime import date, timedelta

from core.database import db
from core.security import hash_password, now_iso


def record_id() -> str:
    return str(uuid.uuid4())


async def seed_data() -> None:
    email = os.environ.get("ADMIN_EMAIL", "admin@divineyogastudio.in").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "yamx1yNHKwKNeKrw7s9LqjAM")
    admin = await db.admin_users.find_one({"email": email}, {"_id": 0})
    if not admin:
        await db.admin_users.insert_one({
            "id": record_id(),
            "email": email,
            "display_name": "Divine Yoga Admin",
            "password_hash": hash_password(admin_password),
            "mfa_enabled": False,
            "failed_login_attempts": 0,
            "locked_until": None,
            "refresh_version": 0,
            "created_at": now_iso(),
            "updated_at": now_iso(),
        })
    if await db.batches.count_documents({}) > 0:
        return
    batch_id = record_id()
    await db.batches.insert_one({"id": batch_id, "name": "Morning Flow", "category_tag": "Mat Yoga", "description": "Foundational mobility and flow.", "instructor_name": "Varsha Kakade", "schedule_days": ["Mon", "Wed", "Fri"], "start_time": "07:30", "end_time": "08:30", "capacity": 18, "is_active": True, "created_at": now_iso()})
    evening_id = record_id()
    await db.batches.insert_one({"id": evening_id, "name": "Evening Aerial", "category_tag": "Aerial Yoga", "description": "Strength, balance and inversion practice.", "instructor_name": "Meera Joshi", "schedule_days": ["Tue", "Thu", "Sat"], "start_time": "17:30", "end_time": "18:30", "capacity": 12, "is_active": True, "created_at": now_iso()})
    plan_id = record_id()
    await db.membership_plans.insert_one({"id": plan_id, "name": "Monthly Unlimited", "plan_type": "monthly", "amount": 2500, "duration_days": 30, "class_credits": None, "is_active": True})
    today = date.today()
    clients = [
        ("Aarohi Mehta", "+919876543210", batch_id, "active", True),
        ("Nisha Kulkarni", "+919876543211", evening_id, "active", True),
        ("Priya Sharma", "+919876543212", batch_id, "paused", False),
    ]
    for index, (name, phone, assigned_batch, status, opted_in) in enumerate(clients):
        client_id = record_id()
        await db.clients.insert_one({"id": client_id, "full_name": name, "phone_number": phone, "whatsapp_opt_in": opted_in, "email": None, "batch_id": assigned_batch, "join_date": str(today - timedelta(days=90)), "status": status, "medical_notes": None, "created_at": now_iso(), "updated_at": now_iso()})
        subscription_id = record_id()
        await db.client_subscriptions.insert_one({"id": subscription_id, "client_id": client_id, "plan_id": plan_id, "start_date": str(today - timedelta(days=30)), "end_date": str(today), "status": "active", "auto_renew": False})
        if index < 2:
            due = today - timedelta(days=(7 if index == 0 else 2))
            await db.payments.insert_one({"id": record_id(), "client_id": client_id, "subscription_id": subscription_id, "amount_due": 2500, "amount_paid": 0, "due_date": str(due), "paid_date": None, "payment_status": "overdue", "payment_mode": None, "transaction_ref": None, "notes": "Monthly renewal", "recorded_by": email, "is_void": False, "created_at": now_iso(), "updated_at": now_iso()})
    await db.reminder_templates.insert_many([
        {"id": record_id(), "name": "Gentle due reminder", "trigger_type": "before_due", "offset_days": 3, "message_body": "Namaste {name}, your {studio_name} fee of ₹{amount} is due on {due_date}. Thank you.", "is_active": True},
        {"id": record_id(), "name": "Overdue follow-up", "trigger_type": "overdue", "offset_days": 3, "message_body": "Namaste {name}, a gentle reminder that ₹{amount} for {month} is overdue. Please reply if you need help.", "is_active": True},
    ])