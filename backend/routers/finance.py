import csv
import io
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse

from core.database import db
from core.security import now_iso
from models.schemas import PaymentInput, PaymentUpdate, SubscriptionInput
from routers.auth import audit, current_admin
from services.seed import record_id


router = APIRouter(prefix="/api/v1/admin", tags=["finance"], dependencies=[Depends(current_admin)])


def payment_status(amount_due: float, amount_paid: float, due_date: str) -> str:
    if amount_paid >= amount_due:
        return "paid"
    if amount_paid > 0:
        return "partial"
    return "overdue" if due_date < str(date.today()) else "pending"


@router.post("/subscriptions")
async def create_subscription(input: SubscriptionInput, request: Request, admin: dict = Depends(current_admin)):
    client = await db.clients.find_one({"id": input.client_id, "is_deleted": {"$ne": True}}, {"_id": 0})
    plan = await db.membership_plans.find_one({"id": input.plan_id, "is_active": True}, {"_id": 0})
    if not client or not plan:
        raise HTTPException(status_code=404, detail="Client or active plan was not found")
    start = input.start_date
    subscription = {"id": record_id(), "client_id": input.client_id, "plan_id": input.plan_id, "start_date": str(start), "end_date": str(start + timedelta(days=plan["duration_days"])), "status": "active", "auto_renew": input.auto_renew}
    await db.client_subscriptions.insert_one(subscription)
    await db.payments.insert_one({"id": record_id(), "client_id": input.client_id, "subscription_id": subscription["id"], "amount_due": plan["amount"], "amount_paid": 0, "due_date": str(start), "paid_date": None, "payment_status": payment_status(plan["amount"], 0, str(start)), "payment_mode": None, "transaction_ref": None, "notes": f"{plan['name']} membership", "recorded_by": admin["email"], "is_void": False, "created_at": now_iso(), "updated_at": now_iso()})
    await audit("subscription_created", request, admin["id"], {"subscription_id": subscription["id"]})
    return subscription


@router.get("/payments")
async def list_payments(status: str = ""):
    query = {"is_void": {"$ne": True}}
    if status:
        query["payment_status"] = status
    payments = await db.payments.find(query, {"_id": 0}).to_list(1000)
    clients = {item["id"]: item for item in await db.clients.find({}, {"_id": 0, "id": 1, "full_name": 1, "phone_number": 1, "whatsapp_opt_in": 1}).to_list(1000)}
    for payment in payments:
        payment["client"] = clients.get(payment["client_id"], {})
        payment["days_overdue"] = max(0, (date.today() - date.fromisoformat(payment["due_date"])).days)
    return sorted(payments, key=lambda item: item["days_overdue"], reverse=True)


@router.post("/payments")
async def create_payment(input: PaymentInput, request: Request, admin: dict = Depends(current_admin)):
    if not await db.clients.find_one({"id": input.client_id, "is_deleted": {"$ne": True}}, {"_id": 0}):
        raise HTTPException(status_code=404, detail="Client was not found")
    data = input.model_dump(mode="json")
    data.update({"id": record_id(), "payment_status": payment_status(data["amount_due"], data["amount_paid"], data["due_date"]), "recorded_by": admin["email"], "is_void": False, "created_at": now_iso(), "updated_at": now_iso()})
    await db.payments.insert_one(data)
    await audit("payment_created", request, admin["id"], {"payment_id": data["id"]})
    return data


@router.patch("/payments/{payment_id}")
async def update_payment(payment_id: str, input: PaymentUpdate, request: Request, admin: dict = Depends(current_admin)):
    payment = await db.payments.find_one({"id": payment_id, "is_void": {"$ne": True}}, {"_id": 0})
    if not payment:
        raise HTTPException(status_code=404, detail="Payment was not found")
    changes = {key: value for key, value in input.model_dump(mode="json").items() if value is not None}
    paid = changes.get("amount_paid", payment["amount_paid"])
    status = changes.get("payment_status", payment_status(payment["amount_due"], paid, payment["due_date"]))
    changes.update({"payment_status": status, "updated_at": now_iso()})
    if status == "paid" and not payment.get("paid_date"):
        changes["paid_date"] = str(date.today())
    await db.payments.update_one({"id": payment_id}, {"$set": changes})
    await audit("payment_updated", request, admin["id"], {"payment_id": payment_id, "status": status})
    return await db.payments.find_one({"id": payment_id}, {"_id": 0})


@router.get("/payments/export")
async def export_payments():
    payments = await list_payments()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Client", "Due date", "Amount due", "Amount paid", "Status", "Days overdue"])
    for payment in payments:
        writer.writerow([payment.get("client", {}).get("full_name", "Unknown"), payment["due_date"], payment["amount_due"], payment["amount_paid"], payment["payment_status"], payment["days_overdue"]])
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=divine-yoga-ledger.csv"})