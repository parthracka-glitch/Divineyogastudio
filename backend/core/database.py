import os
from pathlib import Path
import certifi
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

dotenv_path = Path(__file__).parent.parent / ".env"
if not dotenv_path.exists():
    dotenv_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path)

raw_mongo = (os.environ.get("MONGO_URL") or "").strip()
raw_db = (os.environ.get("DB_NAME") or "").strip()
DB_NAME = raw_db if raw_db else "divine_yoga"
use_mock = os.environ.get("USE_MOCK_DB", "").lower() in ("true", "1") or raw_mongo == "mock"

_active_client = None
_active_db = None


def _create_mongo_client(url: str):
    kwargs = {"serverSelectionTimeoutMS": 10000}
    if url.startswith("mongodb+srv://") or "mongodb.net" in url:
        kwargs["tlsCAFile"] = certifi.where()
    return AsyncIOMotorClient(url, **kwargs)


if use_mock:
    from mongomock_motor import AsyncMongoMockClient
    print("[Database] Using MongoMock in-memory database.")
    _active_client = AsyncMongoMockClient()
    _active_db = _active_client[DB_NAME]
else:
    MONGO_URL = raw_mongo if (raw_mongo and raw_mongo not in ('""', "''")) else "mongodb://localhost:27017"
    _active_client = _create_mongo_client(MONGO_URL)
    _active_db = _active_client[DB_NAME]


async def ensure_connection() -> None:
    global _active_client, _active_db
    if isinstance(_active_client, AsyncIOMotorClient):
        try:
            await _active_client.admin.command("ping")
            print("[Database] Successfully connected to MongoDB cluster!")
        except Exception as err:
            print(f"[Database Error] Connection check to MongoDB failed: {err}")
            # Reconnect attempt without downgrading to volatile in-memory storage
            if not use_mock:
                try:
                    _active_client = _create_mongo_client(MONGO_URL)
                    _active_db = _active_client[DB_NAME]
                except Exception as rec_err:
                    print(f"[Database Error] Reconnection attempt failed: {rec_err}")
            else:
                from mongomock_motor import AsyncMongoMockClient
                _active_client = AsyncMongoMockClient()
                _active_db = _active_client[DB_NAME]


class ClientProxy:
    def close(self):
        if _active_client and hasattr(_active_client, "close"):
            _active_client.close()

    def __getattr__(self, name):
        return getattr(_active_client, name)

client = ClientProxy()


class DatabaseProxy:
    def __getattr__(self, name):
        return getattr(_active_db, name)

    def __getitem__(self, name):
        return _active_db[name]

db = DatabaseProxy()


async def create_indexes() -> None:
    await ensure_connection()
    try:
        await db.admin_users.create_index("email", unique=True)
        await db.clients.create_index("phone_number", unique=True)
        await db.clients.create_index([("full_name", "text"), ("phone_number", "text")])
        await db.payments.create_index([("payment_status", 1), ("due_date", 1)])
        await db.reminder_logs.create_index([("payment_id", 1), ("template_id", 1), ("sent_date", 1)])
    except Exception as err:
        print(f"[Database Warning] create_indexes: {err}")

def get_db():
    return _active_db

