import asyncio
import os
import time
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
MONGO_URL = raw_mongo if (raw_mongo and raw_mongo not in ('""', "''")) else "mongodb://localhost:27017"

_active_client = None
_active_db = None


def _create_mongo_client(url: str):
    kwargs = {
        "serverSelectionTimeoutMS": 5000,
        "connectTimeoutMS": 10000,
        "socketTimeoutMS": 30000,
        "maxPoolSize": 50,
        "minPoolSize": 5,
        "maxIdleTimeMS": 60000,
        "retryWrites": True,
        "retryReads": True,
        "w": "majority",
    }
    if url.startswith("mongodb+srv://") or "mongodb.net" in url:
        kwargs["tlsCAFile"] = certifi.where()
    return AsyncIOMotorClient(url, **kwargs)


def _get_active_client():
    global _active_client, _active_db
    needs_reinit = False
    if _active_client is None:
        needs_reinit = True
    elif hasattr(_active_client, "get_io_loop"):
        try:
            client_loop = _active_client.get_io_loop()
            if client_loop.is_closed():
                needs_reinit = True
        except Exception:
            pass

    if needs_reinit:
        if use_mock:
            from mongomock_motor import AsyncMongoMockClient
            _active_client = AsyncMongoMockClient()
            _active_db = _active_client[DB_NAME]
        else:
            _active_client = _create_mongo_client(MONGO_URL)
            _active_db = _active_client[DB_NAME]

    return _active_client



def _get_active_db():
    _get_active_client()
    return _active_db


# Initial warm up
_get_active_client()


async def ensure_connection() -> None:
    c = _get_active_client()
    if isinstance(c, AsyncIOMotorClient):
        try:
            await c.admin.command("ping")
        except Exception as err:
            print(f"[Database Error] Connection check failed: {err}")
            if not use_mock:
                try:
                    global _active_client, _active_db
                    _active_client = _create_mongo_client(MONGO_URL)
                    _active_db = _active_client[DB_NAME]
                except Exception:
                    pass


class ClientProxy:
    def close(self):
        global _active_client, _active_db
        if _active_client and hasattr(_active_client, "close"):
            try:
                _active_client.close()
            except Exception:
                pass
        _active_client = None
        _active_db = None

    def __getattr__(self, name):
        return getattr(_get_active_client(), name)

client = ClientProxy()



class DatabaseProxy:
    def __getattr__(self, name):
        return getattr(_get_active_db(), name)

    def __getitem__(self, name):
        return _get_active_db()[name]

db = DatabaseProxy()



async def _safe_create_index(collection, keys, **kwargs) -> None:
    try:
        await collection.create_index(keys, **kwargs)
    except Exception as err:
        pass


async def create_indexes() -> None:
    await ensure_connection()
    try:
        # Admin Users
        await _safe_create_index(db.admin_users, "email", unique=True)
        await _safe_create_index(db.admin_users, "id", unique=True)

        # Clients
        await _safe_create_index(db.clients, "phone_number")
        await _safe_create_index(db.clients, "id", unique=True)
        await _safe_create_index(db.clients, [("created_at", -1)])
        await _safe_create_index(db.clients, [("full_name", "text"), ("phone_number", "text")])
        await _safe_create_index(db.clients, [("status", 1), ("next_renewal_date", 1)])
        await _safe_create_index(db.clients, [("batch_id", 1), ("status", 1)])


        # Batches & Plans
        await _safe_create_index(db.batches, "id", unique=True)
        await _safe_create_index(db.batches, "is_active")
        await _safe_create_index(db.membership_plans, "id", unique=True)
        await _safe_create_index(db.membership_plans, "is_active")

        # Subscriptions
        await _safe_create_index(db.subscriptions, "id", unique=True)
        await _safe_create_index(db.subscriptions, [("client_id", 1), ("status", 1)])
        await _safe_create_index(db.subscriptions, "end_date")

        # Payments
        await _safe_create_index(db.payments, "id", unique=True)
        await _safe_create_index(db.payments, "client_id")
        await _safe_create_index(db.payments, [("payment_status", 1), ("due_date", 1)])
        await _safe_create_index(db.payments, "is_void")

        # Reminder logs
        await _safe_create_index(db.reminder_logs, "id", unique=True)
        await _safe_create_index(db.reminder_logs, [("payment_id", 1), ("template_id", 1), ("sent_date", 1)])
        await _safe_create_index(db.reminder_logs, [("client_id", 1), ("sent_date", 1)])
        await _safe_create_index(db.reminder_logs, "sent_date")

        # Push Subscriptions & Settings
        await _safe_create_index(db.push_subscriptions, "endpoint", unique=True)
        await _safe_create_index(db.system_settings, "id", unique=True)

        # Audit Logs
        await _safe_create_index(db.audit_logs, [("timestamp", -1)])
        await _safe_create_index(db.audit_logs, "admin_user_id")

        print("[Database] Schema indexes verified and created successfully.")
    except Exception as err:
        print(f"[Database Warning] create_indexes: {err}")



async def check_database_health() -> dict:
    c = _get_active_client()
    t0 = time.monotonic()
    try:
        if isinstance(c, AsyncIOMotorClient):
            await c.admin.command("ping")
        elapsed_ms = round((time.monotonic() - t0) * 1000, 2)

        return {
            "status": "healthy",
            "connected": True,
            "is_mock": use_mock,
            "latency_ms": elapsed_ms,
            "database_name": DB_NAME,
        }
    except Exception as exc:
        return {
            "status": "unhealthy",
            "connected": False,
            "is_mock": use_mock,
            "error": str(exc),
            "database_name": DB_NAME,
        }


def get_db():
    return _active_db


