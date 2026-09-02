import os
from datetime import date, timedelta

import httpx

from core.database import db
from core.security import now_iso, safe_template_value
from services.push_service import send_web_push
from services.seed import record_id
from services.wati_service import WatiConfigurationError, configured, local_message_id, send_template_message


def rendered_message(template: str, client: dict, payment: dict) -> str:
    values = {
        "name": safe_template_value(client["full_name"]),
        "amount": safe_template_value(f"{payment['amount_due'] - payment['amount_paid']:,.0f}"),
        "due_date": safe_template_value(payment["due_date"]),
        "month": safe_template_value(payment["due_date"][:7]),
        "studio_name": "Divine Yoga Studio",
    }
    return template.format(**values)


def template_parameters(client: dict, payment: dict) -> dict[str, str]:
    return {
        "name": safe_template_value(client["full_name"]),
        "amount": safe_template_value(f"{payment['amount_due'] - payment['amount_paid']:,.0f}"),
        "due_date": safe_template_value(payment["due_date"]),
        "month": safe_template_value(payment["due_date"][:7]),
        "studio_name": "Divine Yoga Studio",
    }


def build_whatsapp_renewal_message(client: dict, renewal_date_str: str, days_diff: int) -> str:
    name = client.get("full_name", "Valued Practitioner")
    plan = client.get("plan_name", "Yoga Membership")
    if days_diff > 0:
        return (
            f"Namaste {name} 🙏\n\n"
            f"This is a gentle reminder from Divine Yoga Studio that your *{plan}* "
            f"is scheduled to expire in {days_diff} day{'s' if days_diff > 1 else ''} on *{renewal_date_str}*.\n\n"
            f"To continue your daily wellness practice without interruption, kindly renew your membership "
            f"at the studio front desk or via UPI.\n\n"
            f"Warm regards,\n*Divine Yoga Studio* 🌿"
        )
    elif days_diff == 0:
        return (
            f"Namaste {name} 🙏\n\n"
            f"Your *{plan}* at Divine Yoga Studio expires *today* (*{renewal_date_str}*).\n\n"
            f"Kindly complete your membership renewal today to keep your attendance active in your batch.\n\n"
            f"Warm regards,\n*Divine Yoga Studio* 🌿"
        )
    else:
        abs_days = abs(days_diff)
        return (
            f"Namaste {name} 🙏\n\n"
            f"Your *{plan}* at Divine Yoga Studio expired on *{renewal_date_str}* ({abs_days} day{'s' if abs_days > 1 else ''} ago).\n\n"
            f"We miss having you on the mat! Please reach out to renew your membership and resume your daily practice.\n\n"
            f"Warm regards,\n*Divine Yoga Studio* 🌿"
        )


def resolve_client_renewal_date(client: dict) -> date | None:
    if client.get("next_renewal_date"):
        try:
            return date.fromisoformat(str(client["next_renewal_date"])[:10])
        except Exception:
            pass
    if client.get("join_date"):
        try:
            join = date.fromisoformat(str(client["join_date"])[:10])
            return join + timedelta(days=30)
        except Exception:
            pass
    return None


async def get_all_expiring_clients(days_ahead: int = 7) -> dict:
    today = date.today()
    clients = await db.clients.find({"is_deleted": {"$ne": True}, "status": {"$in": ["active", "overdue", "expired"]}}, {"_id": 0, "medical_notes": 0}).to_list(1000)

    expiring_today = []
    expiring_soon = []
    expired = []

    for client in clients:
        renewal_date = resolve_client_renewal_date(client)
        if not renewal_date:
            continue

        days_diff = (renewal_date - today).days
        renewal_str = renewal_date.isoformat()
        enriched = dict(client)
        enriched["renewal_date"] = renewal_str
        enriched["days_diff"] = days_diff
        enriched["whatsapp_message"] = build_whatsapp_renewal_message(client, renewal_str, days_diff)

        if days_diff == 0:
            expiring_today.append(enriched)
        elif 0 < days_diff <= days_ahead:
            expiring_soon.append(enriched)
        elif -30 <= days_diff < 0:
            expired.append(enriched)

    # Sort expiring soon by nearest first, expired by most recent first
    expiring_soon.sort(key=lambda x: x["days_diff"])
    expired.sort(key=lambda x: x["days_diff"], reverse=True)

    return {
        "expiring_today": expiring_today,
        "expiring_soon": expiring_soon,
        "expired": expired,
        "total_attention_count": len(expiring_today) + len(expiring_soon) + len(expired),
    }


def generate_owner_digest_text(expiries: dict, today: date) -> str:
    lines = [
        "🧘 *Divine Yoga Studio — Daily Plan Expiry Digest*",
        f"📅 *Date:* {today.strftime('%d %B %Y')}",
        "",
    ]

    today_list = expiries.get("expiring_today", [])
    soon_list = expiries.get("expiring_soon", [])
    expired_list = expiries.get("expired", [])

    if today_list:
        lines.append(f"🔴 *Expiring Today ({len(today_list)} client{'s' if len(today_list) > 1 else ''}):*")
        for c in today_list:
            lines.append(f"• {c['full_name']} ({c.get('batch_name', 'Batch')}) — {c.get('plan_name', 'Plan')}")
        lines.append("")

    if soon_list:
        lines.append(f"⚠️ *Expiring in next 7 days ({len(soon_list)} client{'s' if len(soon_list) > 1 else ''}):*")
        for c in soon_list:
            lines.append(f"• {c['full_name']} ({c.get('batch_name', 'Batch')}) — in {c['days_diff']}d ({c['renewal_date']})")
        lines.append("")

    if expired_list:
        lines.append(f"⏳ *Recently Expired ({len(expired_list)} client{'s' if len(expired_list) > 1 else ''}):*")
        for c in expired_list[:5]:
            lines.append(f"• {c['full_name']} ({c.get('batch_name', 'Batch')}) — expired {abs(c['days_diff'])}d ago")
        if len(expired_list) > 5:
            lines.append(f"  ...and {len(expired_list) - 5} more")
        lines.append("")

    if not (today_list or soon_list or expired_list):
        lines.append("✨ All memberships are currently active and up to date.")
        lines.append("")

    lines.append("👉 *Open your dashboard to review and send 1-click WhatsApp renewals:*")
    lines.append("https://divineyogastudio.in")
    return "\n".join(lines)


async def send_owner_expiry_digest(force: bool = False) -> dict:
    today = date.today()
    expiries = await get_all_expiring_clients(days_ahead=7)
    total_count = expiries["total_attention_count"]

    owner_settings = await db.system_settings.find_one({"id": "owner_settings"}, {"_id": 0}) or {}
    push_enabled = owner_settings.get("push_notifications_enabled", True)
    morning_digest_enabled = owner_settings.get("morning_digest_enabled", True)
    owner_phone = owner_settings.get("owner_whatsapp")

    push_result = {"sent": 0, "failed": 0, "message": "Push disabled"}
    if push_enabled and (total_count > 0 or force):
        today_count = len(expiries["expiring_today"])
        soon_count = len(expiries["expiring_soon"])
        expired_count = len(expiries["expired"])

        if today_count > 0:
            title = f"Divine Yoga: {today_count} Plan{'s' if today_count > 1 else ''} Expiring Today"
            body = f"{today_count} client(s) expire today, {soon_count} upcoming. Tap to send renewals."
        elif soon_count > 0:
            title = f"Divine Yoga: {soon_count} Plans Expiring Soon"
            body = f"{soon_count} client membership(s) expire this week. Tap to review."
        elif expired_count > 0:
            title = f"Divine Yoga: {expired_count} Expired Memberships"
            body = f"{expired_count} client(s) need renewal follow-up. Tap to review."
        else:
            title = "Divine Yoga Studio"
            body = "Daily check complete: all client memberships are up to date."

        push_result = await send_web_push(title=title, body=body, url="/reminders", badge_count=total_count)

    digest_text = generate_owner_digest_text(expiries, today)
    whatsapp_result = {"status": "skipped", "reason": "No owner phone or digest disabled"}

    if morning_digest_enabled and owner_phone:
        log_doc = {
            "id": record_id(),
            "client_id": "owner",
            "client_name": "Studio Owner",
            "phone_number": owner_phone,
            "template_name": "Daily Owner Expiry Digest",
            "channel": "whatsapp_owner",
            "sent_at": now_iso(),
            "sent_date": str(today),
            "delivery_status": "sent",
            "triggered_by": "daily_digest",
            "message_preview": digest_text[:300],
        }
        await db.reminder_logs.insert_one(log_doc)
        whatsapp_result = {"status": "logged", "log_id": log_doc["id"]}

    return {
        "date": str(today),
        "total_attention_count": total_count,
        "push_result": push_result,
        "whatsapp_result": whatsapp_result,
        "digest_text": digest_text,
    }


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
    parameters = template_parameters(client, payment)
    log = {"id": record_id(), "client_id": client["id"], "payment_id": payment["id"], "template_id": template_id, "channel": "whatsapp", "sent_at": now_iso(), "sent_date": today, "delivery_status": "queued", "wati_message_id": None, "triggered_by": triggered_by, "error_message": None, "message_preview": message, "template_parameters": parameters}
    await db.reminder_logs.insert_one(log)
    approved_template = os.environ.get("WATI_PAYMENT_TEMPLATE_NAME", "")
    if configured():
        try:
            response = await send_template_message(client["phone_number"], approved_template, parameters)
            message_id = local_message_id(response)
            await db.reminder_logs.update_one({"id": log["id"]}, {"$set": {"delivery_status": "sent", "wati_message_id": message_id, "wati_template_name": approved_template, "wati_sent_at": now_iso()}})
            log["delivery_status"] = "sent"
            log["wati_message_id"] = message_id
        except (WatiConfigurationError, httpx.HTTPError):
            await db.reminder_logs.update_one({"id": log["id"]}, {"$set": {"delivery_status": "failed", "error_message": "WATI delivery failed. Check the connection and approved template."}})
            log["delivery_status"] = "failed"
            log["error_message"] = "WATI delivery failed. Check the connection and approved template."
    log.pop("_id", None)
    return {"payment_id": payment["id"], "status": log["delivery_status"], "log_id": log["id"]}


async def run_daily_reminders() -> int:
    today = date.today()
    templates = await db.reminder_templates.find({"is_active": True}, {"_id": 0}).to_list(100)
    payments = await db.payments.find({"payment_status": {"$in": ["pending", "partial", "overdue"]}, "is_void": {"$ne": True}}, {"_id": 0}).to_list(1000)
    queued = 0
    for payment in payments:
        try:
            due_str = payment.get("due_date")
            if not due_str:
                continue
            due = date.fromisoformat(str(due_str)[:10])
            for template in templates:
                delta = (due - today).days if template.get("trigger_type") == "before_due" else (today - due).days
                expected = template.get("offset_days", 0) if template.get("trigger_type") != "on_due" else 0
                if delta == expected:
                    result = await queue_reminder(payment, template, "auto")
                    queued += result.get("status") == "queued"
        except Exception as pay_err:
            print(f"[Daily Reminders Warning] Error processing payment {payment.get('id')}: {pay_err}")

    # Also notify owner about plan expiries and send push notification to iPhone/Android
    try:
        await send_owner_expiry_digest(force=False)
    except Exception as ex:
        print(f"[Daily Reminders Warning] Failed to send owner expiry digest: {ex}")


    return queued