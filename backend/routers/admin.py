import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from core.database import db
from core.security import decrypt_text, encrypt_text, now_iso
from models.schemas import BatchInput, ClientInput, PaymentInput, PaymentUpdate, PlanInput, ReminderSendInput, ReminderTemplateInput, SubscriptionInput
from routers.auth import audit, current_admin
from services.reminders import queue_reminder
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
    return {"total_collected": monthly_collected, "total_pending": pending, "overdue_count": len(overdue), "projected_revenue": monthly_collected + pending, "active_clients": clients, "reminders_today": reminder_count}


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
    data.update({"id": record_id(), "medical_notes": encrypt_text(data.get("medical_notes")), "created_at": now_iso(), "updated_at": now_iso(), "is_deleted": False})
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


@router.get("/plans")
async def list_plans():
    return await db.membership_plans.find({}, {"_id": 0}).to_list(100)


@router.post("/plans")
async def create_plan(input: PlanInput, request: Request, admin: dict = Depends(current_admin)):
    data = document(input) | {"id": record_id()}
    await db.membership_plans.insert_one(data)
    await audit("plan_created", request, admin["id"], {"plan_id": data["id"]})
    return data