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

    OFFICIAL_BATCHES = [
        {
            "name": "Morning (Gents & Ladies)",
            "category_tag": "Morning Batch",
            "instructor_name": "Ananya Sharma",
            "schedule_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            "start_time": "07:15",
            "end_time": "08:15",
            "capacity": 20,
            "description": "Energizing morning yoga flow for gents and ladies to start the day with balance and vitality.",
            "is_active": True,
        },
        {
            "name": "Ladies Batch (Morning)",
            "category_tag": "Ladies Special",
            "instructor_name": "Pooja Deshmukh",
            "schedule_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            "start_time": "09:00",
            "end_time": "10:00",
            "capacity": 18,
            "description": "Dedicated morning session focused on women's health, flexibility, hormone balance, and toning.",
            "is_active": True,
        },
        {
            "name": "Pregnancy Yoga",
            "category_tag": "Prenatal Yoga",
            "instructor_name": "Dr. Neha Kulkarni",
            "schedule_days": ["Tue", "Thu", "Sat"],
            "start_time": "16:15",
            "end_time": "17:00",
            "capacity": 12,
            "description": "Doctor-approved prenatal yoga, breathing techniques, pelvic wellness, and gentle strengthening.",
            "is_active": True,
        },
        {
            "name": "Kids Yoga",
            "category_tag": "Kids Yoga",
            "instructor_name": "Snehal Patil",
            "schedule_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            "start_time": "17:00",
            "end_time": "18:00",
            "capacity": 15,
            "description": "Engaging posture alignment, body awareness, focus exercises, and mindfulness for children.",
            "is_active": True,
        },
        {
            "name": "Ladies Batch (Evening)",
            "category_tag": "Ladies Special",
            "instructor_name": "Pooja Deshmukh",
            "schedule_days": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
            "start_time": "18:00",
            "end_time": "19:00",
            "capacity": 18,
            "description": "Evening relaxation, stress relief, core strength, and restorative asanas for women.",
            "is_active": True,
        },
        {
            "name": "Gents & Ladies (Evening)",
            "category_tag": "Evening Batch",
            "instructor_name": "Rahul Verma",
            "schedule_days": ["Mon", "Wed", "Fri"],
            "start_time": "19:00",
            "end_time": "20:00",
            "capacity": 20,
            "description": "Dynamic evening Vinyasa and traditional Hatha practice open to all gents and ladies.",
            "is_active": True,
        },
    ]

    # Seed or synchronize official studio batches
    existing_batches = await db.batches.find({}, {"_id": 0}).to_list(100)
    existing_names = {b.get("name") for b in existing_batches}

    # If DB has old sample batch names from prior iterations, replace or add missing
    has_legacy_batches = any(b.get("name") in ["Morning Hatha Flow", "Evening Vinyasa & Pranayama", "Weekend Meditation & Yin"] for b in existing_batches)
    if has_legacy_batches:
        await db.batches.delete_many({"name": {"$in": ["Morning Hatha Flow", "Evening Vinyasa & Pranayama", "Weekend Meditation & Yin"]}})
        existing_batches = await db.batches.find({}, {"_id": 0}).to_list(100)
        existing_names = {b.get("name") for b in existing_batches}

    for b in OFFICIAL_BATCHES:
        if b["name"] not in existing_names:
            batch_doc = dict(b)
            batch_doc["id"] = record_id()
            batch_doc["created_at"] = now_iso()
            await db.batches.insert_one(batch_doc)

    OFFICIAL_PLANS = [
        {
            "name": "1 Month Plan",
            "plan_type": "monthly",
            "amount": 1800,
            "duration_days": 30,
            "description": "Standard 1-month flexible studio pass for all scheduled batches.",
            "is_active": True,
        },
        {
            "name": "3 Months Plan",
            "plan_type": "quarterly",
            "amount": 4500,
            "duration_days": 90,
            "description": "Quarterly pass with ₹1,500/month effective rate (Save ₹900 · 17% OFF).",
            "is_active": True,
        },
        {
            "name": "6 Months Plan",
            "plan_type": "half_yearly",
            "amount": 7800,
            "duration_days": 180,
            "description": "6 months pass with ₹1,300/month effective rate (Save ₹3,000 · 28% OFF).",
            "is_active": True,
        },
        {
            "name": "1 Year Plan",
            "plan_type": "annual",
            "amount": 12000,
            "duration_days": 365,
            "description": "Full 12 months annual pass with ₹1,000/month best value rate (Save ₹9,600 · 44% OFF).",
            "is_active": True,
        },
    ]

    # Seed or synchronize official membership plans in db.membership_plans
    existing_plans = await db.membership_plans.find({}, {"_id": 0}).to_list(100)
    existing_plan_names = {p.get("name") for p in existing_plans}

    # Clean legacy dummy plans if present
    legacy_plan_names = ["Monthly Unlimited", "Quarterly Pass (3 Months)", "10-Class Drop-in Pass"]
    if any(p.get("name") in legacy_plan_names for p in existing_plans):
        await db.membership_plans.delete_many({"name": {"$in": legacy_plan_names}})
        existing_plans = await db.membership_plans.find({}, {"_id": 0}).to_list(100)
        existing_plan_names = {p.get("name") for p in existing_plans}

    for p in OFFICIAL_PLANS:
        if p["name"] not in existing_plan_names:
            plan_doc = dict(p)
            plan_doc["id"] = record_id()
            plan_doc["created_at"] = now_iso()
            await db.membership_plans.insert_one(plan_doc)

    # Seed Sample Clients & Payments if empty and requested
    seed_demo = os.environ.get("SEED_DEMO_DATA", "false").lower() in ("true", "1")
    if seed_demo and await db.clients.count_documents({}) == 0:
        batches = await db.batches.find({}, {"_id": 0}).sort("start_time", 1).to_list(10)
        b1_name = batches[0]["name"] if len(batches) > 0 else "Morning (Gents & Ladies)"
        b2_name = batches[1]["name"] if len(batches) > 1 else "Ladies Batch (Morning)"
        b3_name = batches[2]["name"] if len(batches) > 2 else "Pregnancy Yoga"
        b1_id = batches[0]["id"] if len(batches) > 0 else None
        b2_id = batches[1]["id"] if len(batches) > 1 else None
        b3_id = batches[2]["id"] if len(batches) > 2 else None

        c1_id, c2_id, c3_id, c4_id, c5_id = record_id(), record_id(), record_id(), record_id(), record_id()
        today = date.today()

        clients_data = [
            {
                "id": c1_id,
                "full_name": "Aarav Mehta",
                "phone_number": "+919876543210",
                "email": "aarav.m@example.com",
                "batch_id": b1_id,
                "batch_name": b1_name,
                "plan_name": "1 Month Plan",
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
                "batch_id": b2_id,
                "batch_name": b2_name,
                "plan_name": "1 Month Plan",
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
                "batch_id": b3_id,
                "batch_name": b3_name,
                "plan_name": "1 Month Plan",
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
                "batch_id": b1_id,
                "batch_name": b1_name,
                "plan_name": "3 Months Plan",
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
                "batch_id": b2_id,
                "batch_name": b2_name,
                "plan_name": "6 Months Plan",
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
                "amount": 1800,
                "amount_due": 1800,
                "amount_paid": 1800,
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
                "amount": 1800,
                "amount_due": 1800,
                "amount_paid": 1800,
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
                "amount": 1800,
                "amount_due": 1800,
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
                "amount": 4500,
                "amount_due": 4500,
                "amount_paid": 4500,
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
                "amount": 7800,
                "amount_due": 7800,
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
