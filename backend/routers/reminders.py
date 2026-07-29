import os

from fastapi import APIRouter, Depends, HTTPException, Request

from core.database import db
from core.security import now_iso
from models.schemas import ReminderSendInput, ReminderTemplateInput
from routers.auth import audit, current_admin
from services.reminders import queue_reminder
from services.seed import record_id


router = APIRouter(prefix="/api/v1", tags=["reminders"])
admin_router = APIRouter(prefix="/api/v1/admin/reminders", tags=["reminders"], dependencies=[Depends(current_admin)])


@admin_router.get("/templates")
async def list_templates():
    return await db.reminder_templates.find({}, {"_id": 0}).to_list(100)


@admin_router.post("/templates")
async def create_template(input: ReminderTemplateInput, request: Request, admin: dict = Depends(current_admin)):
    template = input.model_dump() | {"id": record_id()}
    await db.reminder_templates.insert_one(template)
    await audit("reminder_template_created", request, admin["id"], {"template_id": template["id"]})
    return template


@admin_router.put("/templates/{template_id}")
async def update_template(template_id: str, input: ReminderTemplateInput, request: Request, admin: dict = Depends(current_admin)):
    existing = await db.reminder_templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    updated_data = input.model_dump()
    await db.reminder_templates.update_one({"id": template_id}, {"$set": updated_data})
    await audit("reminder_template_updated", request, admin["id"], {"template_id": template_id})
    return {"id": template_id} | updated_data


@admin_router.delete("/templates/{template_id}")
async def delete_template(template_id: str, request: Request, admin: dict = Depends(current_admin)):
    result = await db.reminder_templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    await audit("reminder_template_deleted", request, admin["id"], {"template_id": template_id})
    return {"message": "Template deleted"}


@admin_router.get("/logs")
async def list_logs():
    logs = await db.reminder_logs.find({}, {"_id": 0}).sort("sent_at", -1).to_list(500)
    clients = {client["id"]: client["full_name"] for client in await db.clients.find({}, {"_id": 0, "id": 1, "full_name": 1}).to_list(1000)}
    for log in logs:
        log["client_name"] = clients.get(log["client_id"], "Unknown client")
    return logs


@admin_router.post("/send-manual")
async def send_manual(input: ReminderSendInput, request: Request, admin: dict = Depends(current_admin)):
    template = None
    if input.template_id:
        template = await db.reminder_templates.find_one({"id": input.template_id, "is_active": True}, {"_id": 0})
        if not template:
            raise HTTPException(status_code=404, detail="Reminder template was not found")
    results = []
    for payment_id in input.payment_ids:
        payment = await db.payments.find_one({"id": payment_id, "is_void": {"$ne": True}}, {"_id": 0})
        if payment:
            results.append(await queue_reminder(payment, template, "manual"))
    await audit("reminders_queued_manually", request, admin["id"], {"payment_count": len(results)})
    return {"results": results}


@admin_router.post("/send-batch")
async def send_batch(input: ReminderSendInput, request: Request, admin: dict = Depends(current_admin)):
    return await send_manual(input, request, admin)


@router.post("/webhooks/wati")
async def wati_webhook(request: Request):
    expected_key = os.environ.get("WATI_WEBHOOK_API_KEY", "")
    authorization = request.headers.get("authorization", "")
    if not expected_key:
        raise HTTPException(status_code=503, detail="WATI webhook is not configured")
    if authorization != f"Bearer {expected_key}":
        raise HTTPException(status_code=401, detail="Webhook authorization is invalid")
    payload = await request.json()
    message_id = payload.get("localMessageId") or payload.get("messageId") or payload.get("id")
    delivery_status = str(payload.get("statusString") or payload.get("status") or "sent").lower()
    if message_id:
        await db.reminder_logs.update_one({"wati_message_id": message_id}, {"$set": {"delivery_status": delivery_status, "wati_event_type": payload.get("eventType"), "wati_whatsapp_message_id": payload.get("whatsappMessageId"), "webhook_updated_at": now_iso()}})
    return {"ok": True}