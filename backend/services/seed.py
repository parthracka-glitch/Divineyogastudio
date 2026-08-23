import os
import uuid
from datetime import date, timedelta

from core.database import ensure_connection, get_db
from core.security import hash_password, now_iso


def record_id() -> str:
    return str(uuid.uuid4())


async def seed_data() -> None:
    await ensure_connection()
    db = get_db()
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

    if await db.reminder_templates.count_documents({}) == 0:
        await db.reminder_templates.insert_many([
            {"id": record_id(), "name": "Gentle due reminder", "trigger_type": "before_due", "offset_days": 3, "message_body": "Namaste {name}, your {studio_name} fee of ₹{amount} is due on {due_date}. Thank you.", "is_active": True},
            {"id": record_id(), "name": "Overdue follow-up", "trigger_type": "overdue", "offset_days": 3, "message_body": "Namaste {name}, a gentle reminder that ₹{amount} for {month} is overdue. Please reply if you need help.", "is_active": True},
        ])

    # Seed Batches if empty
    if await db.batches.count_documents({}) == 0:
        b1_id, b2_id, b3_id = record_id(), record_id(), record_id()
        await db.batches.insert_many([
            {"id": b1_id, "name": "Morning Hatha Flow", "schedule_time": "07:00 AM - 08:15 AM", "instructor": "Ananya Sharma", "capacity": 20, "active_count": 12, "days": "Mon - Fri", "created_at": now_iso()},
            {"id": b2_id, "name": "Evening Vinyasa & Pranayama", "schedule_time": "06:00 PM - 07:15 PM", "instructor": "Rahul Verma", "capacity": 18, "active_count": 14, "days": "Mon - Fri", "created_at": now_iso()},
            {"id": b3_id, "name": "Weekend Meditation & Yin", "schedule_time": "08:30 AM - 10:00 AM", "instructor": "Priya Nair", "capacity": 15, "active_count": 8, "days": "Sat - Sun", "created_at": now_iso()},
        ])

    # Seed Plans if empty
    if await db.plans.count_documents({}) == 0:
        p1_id, p2_id, p3_id = record_id(), record_id(), record_id()
        await db.plans.insert_many([
            {"id": p1_id, "name": "Monthly Unlimited", "billing_period": "monthly", "amount": 3500, "description": "Unlimited access to all daily group sessions", "is_active": True, "created_at": now_iso()},
            {"id": p2_id, "name": "Quarterly Pass (3 Months)", "billing_period": "quarterly", "amount": 9000, "description": "3 months unlimited access with 1 free workshop", "is_active": True, "created_at": now_iso()},
            {"id": p3_id, "name": "10-Class Drop-in Pass", "billing_period": "pass", "amount": 2500, "description": "Valid for 10 classes over 60 days", "is_active": True, "created_at": now_iso()},
        ])

    # Seed Sample Clients & Payments if empty and requested
    seed_demo = os.environ.get("SEED_DEMO_DATA", "false").lower() in ("true", "1")
    if seed_demo and await db.clients.count_documents({}) == 0:
        batches = await db.batches.find({}, {"_id": 0}).to_list(10)
        b1_name = batches[0]["name"] if len(batches) > 0 else "Morning Hatha Flow"
        b2_name = batches[1]["name"] if len(batches) > 1 else "Evening Vinyasa & Pranayama"
        b3_name = batches[2]["name"] if len(batches) > 2 else "Weekend Meditation & Yin"

        c1_id, c2_id, c3_id, c4_id, c5_id = record_id(), record_id(), record_id(), record_id(), record_id()
        today = date.today()

        clients_data = [
            {
                "id": c1_id,
                "full_name": "Aarav Mehta",
                "phone_number": "+919876543210",
                "email": "aarav.m@example.com",
                "batch_name": b1_name,
                "plan_name": "Monthly Unlimited",
                "status": "active",
                "join_date": (today - timedelta(days=90)).isoformat(),
                "whatsapp_opt_in": True,
                "notes": "Regular practitioner, prefers morning slots.",
                "created_at": now_iso(),
                "updated_at": now_iso()
            },
            {
                "id": c2_id,
                "full_name": "Diya Kapoor",
                "phone_number": "+919812345678",
                "email": "diya.k@example.com",
                "batch_name": b2_name,
                "plan_name": "Monthly Unlimited",
                "status": "active",
                "join_date": (today - timedelta(days=60)).isoformat(),
                "whatsapp_opt_in": True,
                "notes": "Interested in prenatal yoga modules.",
                "created_at": now_iso(),
                "updated_at": now_iso()
            },
            {
                "id": c3_id,
                "full_name": "Rohan Singhania",
                "phone_number": "+919988776655",
                "email": "rohan.s@example.com",
                "batch_name": b3_name,
                "plan_name": "Monthly Unlimited",
                "status": "overdue",
                "join_date": (today - timedelta(days=120)).isoformat(),
                "whatsapp_opt_in": True,
                "notes": "Follow up via WhatsApp for fee renewal.",
                "created_at": now_iso(),
                "updated_at": now_iso()
            },
            {
                "id": c4_id,
                "full_name": "Sneha Patel",
                "phone_number": "+919765432109",
                "email": "sneha.p@example.com",
                "batch_name": b1_name,
                "plan_name": "Quarterly Pass (3 Months)",
                "status": "active",
                "join_date": (today - timedelta(days=45)).isoformat(),
                "whatsapp_opt_in": True,
                "notes": "Quarterly subscription member.",
                "created_at": now_iso(),
                "updated_at": now_iso()
            },
            {
                "id": c5_id,
                "full_name": "Vikram Joshi",
                "phone_number": "+919898989898",
                "email": "vikram.j@example.com",
                "batch_name": b2_name,
                "plan_name": "10-Class Drop-in Pass",
                "status": "pending",
                "join_date": (today - timedelta(days=15)).isoformat(),
                "whatsapp_opt_in": True,
                "notes": "Payment due in 3 days.",
                "created_at": now_iso(),
                "updated_at": now_iso()
            }
        ]
        await db.clients.insert_many(clients_data)

        payments_data = [
            {
                "id": record_id(),
                "client_id": c1_id,
                "client_name": "Aarav Mehta",
                "phone_number": "+919876543210",
                "amount": 3500,
                "amount_due": 3500,
                "amount_paid": 3500,
                "payment_status": "paid",
                "billing_month": today.strftime("%B %Y"),
                "due_date": (today + timedelta(days=20)).isoformat(),
                "payment_date": today.isoformat(),
                "payment_method": "UPI",
                "receipt_no": "REC-2026-001",
                "created_at": now_iso()
            },
            {
                "id": record_id(),
                "client_id": c2_id,
                "client_name": "Diya Kapoor",
                "phone_number": "+919812345678",
                "amount": 3500,
                "amount_due": 3500,
                "amount_paid": 3500,
                "payment_status": "paid",
                "billing_month": today.strftime("%B %Y"),
                "due_date": (today + timedelta(days=18)).isoformat(),
                "payment_date": today.isoformat(),
                "payment_method": "Card",
                "receipt_no": "REC-2026-002",
                "created_at": now_iso()
            },
            {
                "id": record_id(),
                "client_id": c3_id,
                "client_name": "Rohan Singhania",
                "phone_number": "+919988776655",
                "amount": 3500,
                "amount_due": 3500,
                "amount_paid": 0,
                "payment_status": "overdue",
                "billing_month": (today - timedelta(days=30)).strftime("%B %Y"),
                "due_date": (today - timedelta(days=5)).isoformat(),
                "payment_date": None,
                "payment_method": None,
                "receipt_no": None,
                "created_at": now_iso()
            },
            {
                "id": record_id(),
                "client_id": c4_id,
                "client_name": "Sneha Patel",
                "phone_number": "+919765432109",
                "amount": 9000,
                "amount_due": 9000,
                "amount_paid": 9000,
                "payment_status": "paid",
                "billing_month": "Q1 2026",
                "due_date": (today + timedelta(days=45)).isoformat(),
                "payment_date": today.isoformat(),
                "payment_method": "Bank Transfer",
                "receipt_no": "REC-2026-003",
                "created_at": now_iso()
            },
            {
                "id": record_id(),
                "client_id": c5_id,
                "client_name": "Vikram Joshi",
                "phone_number": "+919898989898",
                "amount": 2500,
                "amount_due": 2500,
                "amount_paid": 0,
                "payment_status": "pending",
                "billing_month": today.strftime("%B %Y"),
                "due_date": (today + timedelta(days=3)).isoformat(),
                "payment_date": None,
                "payment_method": None,
                "receipt_no": None,
                "created_at": now_iso()
            }
        ]
        await db.payments.insert_many(payments_data)
