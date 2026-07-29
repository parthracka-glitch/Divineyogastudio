from datetime import date

from core.database import db
from core.security import now_iso, safe_template_value
from services.seed import record_id


def rendered_message(template: str, client: dict, payment: dict) -> str:
    values = {
        "name": safe_template_value(client["full_name"]),
        "amount": safe_template_value(f"{payment['amount_due'] - payment['amount_paid']:,.0f}"),
        "due_date": safe_template_value(payment["due_date"]),
        "month": safe_template_value(payment["due_date"][:7]),
        "studio_name": "Divine Yoga Studio",
    }
    return template.format(**values)


async def queue_reminder(payment: dict, template: dict | None, triggered_by: str) -> dict:
    client = await db.clients.find_one({"id": payment["client_id"]}, {"_id": 0})
    if not client or not client.get("whatsapp_opt_in", False):
        return {"payment_id": payment["id"], "status": "skipped", "reason": "WhatsApp opt-in is not enabled"}
    today = str(date.today())
    template_id = template["id"] if template else None
    existing = await db.reminder_logs.find_one({"payment_id": payment["id"], "template_id": template_id, "sent_date": today}, {"_id": 0})
    if existing and triggered_by == "auto":
        return {"payment_id": payment["id"], "status": "skipped", "reason": "Already queued today"}
    message = rendered_message(template["message_body"], client, payment) if template else "Payment reminder from Divine Yoga Studio"
    log = {"id": record_id(), "client_id": client["id"], "payment_id": payment["id"], "template_id": template_id, "channel": "whatsapp", "sent_at": now_iso(), "sent_date": today, "delivery_status": "queued", "wati_message_id": None, "triggered_by": triggered_by, "error_message": None, "message_preview": message}
    await db.reminder_logs.insert_one(log)
    log.pop("_id", None)
    return {"payment_id": payment["id"], "status": "queued", "log_id": log["id"]}


async def run_daily_reminders() -> int:
    today = date.today()
    templates = await db.reminder_templates.find({"is_active": True}, {"_id": 0}).to_list(100)
    payments = await db.payments.find({"payment_status": {"$in": ["pending", "partial", "overdue"]}, "is_void": {"$ne": True}}, {"_id": 0}).to_list(1000)
    queued = 0
    for payment in payments:
        due = date.fromisoformat(payment["due_date"])
        for template in templates:
            delta = (due - today).days if template["trigger_type"] == "before_due" else (today - due).days
            expected = template["offset_days"] if template["trigger_type"] != "on_due" else 0
            if delta == expected:
                result = await queue_reminder(payment, template, "auto")
                queued += result["status"] == "queued"
    return queued