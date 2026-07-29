import os

from motor.motor_asyncio import AsyncIOMotorClient


MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "divine_yoga")

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]


async def create_indexes() -> None:
    await db.admin_users.create_index("email", unique=True)
    await db.clients.create_index("phone_number", unique=True)
    await db.clients.create_index([("full_name", "text"), ("phone_number", "text")])
    await db.payments.create_index([("payment_status", 1), ("due_date", 1)])
    await db.reminder_logs.create_index([("payment_id", 1), ("template_id", 1), ("sent_date", 1)])