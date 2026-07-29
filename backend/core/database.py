import os

from motor.motor_asyncio import AsyncIOMotorClient


client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


async def create_indexes() -> None:
    await db.admin_users.create_index("email", unique=True)
    await db.clients.create_index("phone_number", unique=True)
    await db.clients.create_index([("full_name", "text"), ("phone_number", "text")])
    await db.payments.create_index([("payment_status", 1), ("due_date", 1)])
    await db.reminder_logs.create_index([("payment_id", 1), ("template_id", 1), ("sent_date", 1)])