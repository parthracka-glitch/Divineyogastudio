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
    if await db.reminder_templates.count_documents({}) == 0:
        await db.reminder_templates.insert_many([
            {"id": record_id(), "name": "Gentle due reminder", "trigger_type": "before_due", "offset_days": 3, "message_body": "Namaste {name}, your {studio_name} fee of ₹{amount} is due on {due_date}. Thank you.", "is_active": True},
            {"id": record_id(), "name": "Overdue follow-up", "trigger_type": "overdue", "offset_days": 3, "message_body": "Namaste {name}, a gentle reminder that ₹{amount} for {month} is overdue. Please reply if you need help.", "is_active": True},
        ])