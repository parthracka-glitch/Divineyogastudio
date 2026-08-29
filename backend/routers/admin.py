import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from core.database import db
from core.security import decrypt_text, encrypt_text, now_iso
from models.schemas import (
    BatchInput,
    ClientInput,
    OwnerSettingsInput,
    PaymentInput,
    PaymentUpdate,
    PlanInput,
    PushSubscriptionInput,
    ReminderSendInput,
    ReminderTemplateInput,
    SubscriptionInput,
)
from routers.auth import audit, current_admin
from services.push_service import (
    get_public_vapid_key,
    remove_subscription,
    save_subscription,
    send_web_push,
)
from services.reminders import (
    get_all_expiring_clients,
    queue_reminder,
    send_owner_expiry_digest,
)
from services.seed import record_id


router = APIRouter(prefix="/api/v1/admin", tags=["admin"], dependencies=[Depends(current_admin)])


@router.post("/reset-database")
async def reset_database_route(request: Request, admin: dict = Depends(current_admin)):
    from core.database import create_indexes
    from services.seed import seed_data
    collections = await db.list_collection_names()
    for name in collections:
        if not name.startswith("system."):
            await db[name].delete_many({})
    await create_indexes()
    await seed_data()
    await audit("reset_database", request, admin["id"])
    return {"message": "Database successfully reset and re-seeded cleanly"}


def document(input_data) -> dict:
    data = input_data.model_dump(mode="json")
    return {key: value for key, value in data.items() if value is not None}


async def find_or_404(collection: str, resource_id: str) -> dict:
    item = await db[collection].find_one({"id": resource_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Record not found")
    return item


@router.get("/dashboard/summary")
async def dashboard_summary():
    payments = await db.payments.find({"is_void": {"$ne": True}}, {"_id": 0}).to_list(1000)
    today = date.today()
    monthly_collected = sum(
        payment["amount_paid"]
        for payment in payments
        if (payment.get("paid_date") or "")[:7] == today.strftime("%Y-%m")
    )
    open_payments = [p for p in payments if p["payment_status"] in ["pending", "partial", "overdue"]]
    pending = sum(p["amount_due"] - p["amount_paid"] for p in open_payments)
    overdue = [p for p in open_payments if p["due_date"] < str(today)]
    clients = await db.clients.count_documents({"status": "active"})
    reminder_count = await db.reminder_logs.count_documents({"sent_date": str(today)})

    # Expiry counts for dashboard metrics and attention
    expiries = await get_all_expiring_clients(days_ahead=7)

    return {
        "total_collected": monthly_collected,
        "total_pending": pending,
        "overdue_count": len(overdue),
        "projected_revenue": monthly_collected + pending,
        "active_clients": clients,
        "reminders_today": reminder_count,
        "expiring_today_count": len(expiries["expiring_today"]),
        "expiring_soon_count": len(expiries["expiring_soon"]),
        "expired_count": len(expiries["expired"]),
        "total_expiring_attention": expiries["total_attention_count"],
    }



@router.get("/dashboard/revenue-trend")
async def revenue_trend():
    payments = await db.payments.find({"amount_paid": {"$gt": 0}, "is_void": {"$ne": True}}, {"_id": 0}).to_list(1000)
    result = {}
    for payment in payments:
        month = (payment.get("paid_date") or "")[:7]
        if month:
            result[month] = result.get(month, 0) + payment["amount_paid"]
    return [{"month": month, "collected": amount} for month, amount in sorted(result.items())][-6:]


@router.get("/clients")
async def list_clients(search: str = "", status: str = "", batch_id: str = ""):
    query = {"is_deleted": {"$ne": True}}
    if status:
        query["status"] = status
    if batch_id:
        query["batch_id"] = batch_id
    if search:
        query["$or"] = [{"full_name": {"$regex": search, "$options": "i"}}, {"phone_number": {"$regex": search, "$options": "i"}}]
    return await db.clients.find(query, {"_id": 0, "medical_notes": 0}).sort("created_at", -1).to_list(500)


@router.post("/clients")
async def create_client(input: ClientInput, request: Request, admin: dict = Depends(current_admin)):
    data = document(input)
    client_id = record_id()
    data.update({
        "id": client_id,
        "medical_notes": encrypt_text(data.get("medical_notes")),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "is_deleted": False
    })

    # Auto-resolve batch name
    if data.get("batch_id"):
        batch = await db.batches.find_one({"id": data["batch_id"]}, {"_id": 0})
        if batch:
            data["batch_name"] = batch.get("name")

    # Auto-resolve plan and generate subscription + initial payment ledger invoice
    plan_id = data.get("plan_id")
    if plan_id:
        plan = await db.membership_plans.find_one({"id": plan_id}, {"_id": 0})
        if plan:
            data["plan_name"] = plan.get("name")
            duration_days = int(plan.get("duration_days", 30))
            join_date_obj = date.fromisoformat(str(data["join_date"]))
            renewal_date = (join_date_obj + timedelta(days=duration_days)).isoformat()
            data["next_renewal_date"] = renewal_date

            # 1. Create active subscription
            sub_id = record_id()
            sub_doc = {
                "id": sub_id,
                "client_id": client_id,
                "client_name": data["full_name"],
                "plan_id": plan["id"],
                "plan_name": plan["name"],
                "amount": plan["amount"],
                "start_date": str(data["join_date"]),
                "end_date": renewal_date,
                "status": "active",
                "created_at": now_iso()
            }
            await db.subscriptions.insert_one(sub_doc)

            # 2. Auto-generate payment / invoice record
            init_status = data.get("initial_payment_status") or "paid"
            amount_due = float(plan.get("amount", 1800))
            if init_status == "paid":
                amount_paid = float(data.get("initial_amount_paid") or amount_due)
                pay_status = "paid"
                pay_date = str(data["join_date"])
                due_date_str = renewal_date
            elif init_status == "partial":
                amount_paid = float(data.get("initial_amount_paid") or 0)
                pay_status = "partial" if amount_paid > 0 else "pending"
                pay_date = str(data["join_date"]) if amount_paid > 0 else None
                due_date_str = (join_date_obj + timedelta(days=7)).isoformat()
            else:
                amount_paid = 0.0
                pay_status = "pending"
                pay_date = None
                due_date_str = (join_date_obj + timedelta(days=3)).isoformat()

            pay_id = record_id()
            receipt_no = f"REC-{join_date_obj.year}-{pay_id[:5].upper()}" if amount_paid > 0 else None

            payment_doc = {
                "id": pay_id,
                "client_id": client_id,
                "client_name": data["full_name"],
                "phone_number": data["phone_number"],
                "subscription_id": sub_id,
                "batch_id": data.get("batch_id"),
                "batch_name": data.get("batch_name"),
                "plan_id": plan["id"],
                "plan_name": plan["name"],
                "amount": amount_due,
                "amount_due": amount_due,
                "amount_paid": amount_paid,
                "payment_status": pay_status,
                "billing_month": join_date_obj.strftime("%B %Y"),
                "due_date": due_date_str,
                "payment_date": pay_date,
                "payment_method": data.get("payment_method") or ("UPI" if amount_paid > 0 else None),
                "receipt_no": receipt_no,
                "notes": data.get("notes") or f"Initial {plan['name']} membership fee",
                "created_at": now_iso()
            }
            await db.payments.insert_one(payment_doc)

    try:
        await db.clients.insert_one(data)
    except Exception as exc:
        raise HTTPException(status_code=409, detail="A client with this phone number already exists") from exc

    data.pop("_id", None)
    data["medical_notes"] = decrypt_text(data.get("medical_notes"))
    await audit("client_created", request, admin["id"], {"client_id": data["id"]})
    return data


@router.get("/clients/{client_id}")
async def get_client(client_id: str):
    client = await find_or_404("clients", client_id)
    client["medical_notes"] = decrypt_text(client.get("medical_notes"))
    client["payments"] = await db.payments.find({"client_id": client_id, "is_void": {"$ne": True}}, {"_id": 0}).to_list(100)
    return client


@router.patch("/clients/{client_id}")
async def update_client(client_id: str, input: ClientInput, request: Request, admin: dict = Depends(current_admin)):
    await find_or_404("clients", client_id)
    data = document(input)

    # Auto-resolve batch name if changed
    if data.get("batch_id"):
        batch = await db.batches.find_one({"id": data["batch_id"]}, {"_id": 0})
        if batch:
            data["batch_name"] = batch.get("name")

    # Auto-resolve plan name if changed
    if data.get("plan_id"):
        plan = await db.membership_plans.find_one({"id": data["plan_id"]}, {"_id": 0})
        if plan:
            data["plan_name"] = plan.get("name")
            if "join_date" in data:
                duration_days = int(plan.get("duration_days", 30))
                join_date_obj = date.fromisoformat(str(data["join_date"]))
                data["next_renewal_date"] = (join_date_obj + timedelta(days=duration_days)).isoformat()

    data["medical_notes"] = encrypt_text(data.get("medical_notes"))
    data["updated_at"] = now_iso()
    await db.clients.update_one({"id": client_id}, {"$set": data})
    await audit("client_updated", request, admin["id"], {"client_id": client_id})
    return await get_client(client_id)


@router.delete("/clients/{client_id}")
async def delete_client(client_id: str, request: Request, admin: dict = Depends(current_admin)):
    await find_or_404("clients", client_id)
    await db.clients.update_one({"id": client_id}, {"$set": {"is_deleted": True, "status": "cancelled", "updated_at": now_iso()}})
    await audit("client_deleted", request, admin["id"], {"client_id": client_id})
    return {"ok": True}


@router.get("/batches")
async def list_batches():
    return await db.batches.find({}, {"_id": 0}).sort("start_time", 1).to_list(100)


@router.post("/batches")
async def create_batch(input: BatchInput, request: Request, admin: dict = Depends(current_admin)):
    data = document(input) | {"id": record_id(), "created_at": now_iso()}
    await db.batches.insert_one(data)
    await audit("batch_created", request, admin["id"], {"batch_id": data["id"]})
    return data


@router.patch("/batches/{batch_id}")
async def update_batch(batch_id: str, input: BatchInput, request: Request, admin: dict = Depends(current_admin)):
    await find_or_404("batches", batch_id)
    data = document(input)
    data["updated_at"] = now_iso()
    await db.batches.update_one({"id": batch_id}, {"$set": data})
    await audit("batch_updated", request, admin["id"], {"batch_id": batch_id})
    return await find_or_404("batches", batch_id)


@router.delete("/batches/{batch_id}")
async def delete_batch(batch_id: str, request: Request, admin: dict = Depends(current_admin)):
    await find_or_404("batches", batch_id)
    await db.batches.delete_one({"id": batch_id})
    await audit("batch_deleted", request, admin["id"], {"batch_id": batch_id})
    return {"ok": True}


@router.get("/plans")
async def list_plans():
    return await db.membership_plans.find({}, {"_id": 0}).to_list(100)


@router.post("/plans")
async def create_plan(input: PlanInput, request: Request, admin: dict = Depends(current_admin)):
    data = document(input) | {"id": record_id()}
    await db.membership_plans.insert_one(data)
    await audit("plan_created", request, admin["id"], {"plan_id": data["id"]})
    return data


@router.patch("/plans/{plan_id}")
async def update_plan(plan_id: str, input: PlanInput, request: Request, admin: dict = Depends(current_admin)):
    await find_or_404("membership_plans", plan_id)
    data = document(input)
    await db.membership_plans.update_one({"id": plan_id}, {"$set": data})
    await audit("plan_updated", request, admin["id"], {"plan_id": plan_id})
    return await find_or_404("membership_plans", plan_id)


@router.delete("/plans/{plan_id}")
async def delete_plan(plan_id: str, request: Request, admin: dict = Depends(current_admin)):
    await find_or_404("membership_plans", plan_id)
    await db.membership_plans.delete_one({"id": plan_id})
    await audit("plan_deleted", request, admin["id"], {"plan_id": plan_id})
    return {"ok": True}


# --- Expiring Memberships & Plan Renewals ---

@router.get("/clients/expiring")
async def list_expiring_clients(days_ahead: int = 7):
    return await get_all_expiring_clients(days_ahead=days_ahead)


# --- Web Push (iPhone PWA & Android) Endpoints ---

@router.get("/push/vapid-public-key")
async def get_vapid_key():
    public_key = await get_public_vapid_key()
    return {"public_key": public_key}


@router.post("/push/subscribe")
async def subscribe_push(input: PushSubscriptionInput, request: Request, admin: dict = Depends(current_admin)):
    sub_data = input.model_dump()
    result = await save_subscription(sub_data, admin_id=admin["id"])
    await audit("push_subscribed", request, admin["id"], {"device_info": input.device_info})
    return result


@router.post("/push/unsubscribe")
async def unsubscribe_push(payload: dict, request: Request, admin: dict = Depends(current_admin)):
    endpoint = payload.get("endpoint")
    if not endpoint:
        raise HTTPException(status_code=400, detail="Missing endpoint")
    await remove_subscription(endpoint)
    await audit("push_unsubscribed", request, admin["id"])
    return {"status": "unsubscribed"}


@router.post("/push/test")
async def test_push_notification(request: Request, admin: dict = Depends(current_admin)):
    result = await send_web_push(
        title="🔔 Divine Yoga Studio",
        body="Notifications are working! You will receive client plan expiry reminders here on your lock screen.",
        url="/reminders",
        badge_count=1,
    )
    await audit("push_test_sent", request, admin["id"], result)
    return result


# --- Owner Notification Settings & Daily Digest ---

@router.get("/owner-settings")
async def get_owner_settings():
    doc = await db.system_settings.find_one({"id": "owner_settings"}, {"_id": 0})
    if not doc:
        return {
            "owner_whatsapp": "+919373574918",
            "morning_digest_enabled": True,
            "push_notifications_enabled": True,
            "expiry_remind_days": [7, 3, 0],
        }
    return doc


@router.put("/owner-settings")
async def update_owner_settings(input: OwnerSettingsInput, request: Request, admin: dict = Depends(current_admin)):
    data = input.model_dump() | {"id": "owner_settings", "updated_at": now_iso()}
    await db.system_settings.update_one({"id": "owner_settings"}, {"$set": data}, upsert=True)
    await audit("owner_settings_updated", request, admin["id"], {"whatsapp": input.owner_whatsapp})
    return data


@router.post("/owner-digest/trigger")
async def trigger_owner_digest(request: Request, admin: dict = Depends(current_admin)):
    result = await send_owner_expiry_digest(force=True)
    await audit("owner_digest_triggered", request, admin["id"], {"attention_count": result["total_attention_count"]})
    return result