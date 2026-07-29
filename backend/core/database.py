import os

from motor.motor_asyncio import AsyncIOMotorClient


raw_mongo = (os.environ.get("MONGO_URL") or "").strip()
if not raw_mongo or raw_mongo in ('""', "''"):
    MONGO_URL = "mongodb://localhost:27017"
else:
    MONGO_URL = raw_mongo

raw_db = (os.environ.get("DB_NAME") or "").strip()
DB_NAME = raw_db if raw_db else "divine_yoga"

try:
    client = AsyncIOMotorClient(MONGO_URL)
except Exception as err:
    print(f"[Database Warning] Invalid MONGO_URL configuration ({MONGO_URL}): {err}. Falling back to localhost client.")
    client = AsyncIOMotorClient("mongodb://localhost:27017")

db = client[DB_NAME]


async def create_indexes() -> None:
    await db.admin_users.create_index("email", unique=True)
    await db.clients.create_index("phone_number", unique=True)
    await db.clients.create_index([("full_name", "text"), ("phone_number", "text")])
    await db.payments.create_index([("payment_status", 1), ("due_date", 1)])
    await db.reminder_logs.create_index([("payment_id", 1), ("template_id", 1), ("sent_date", 1)])