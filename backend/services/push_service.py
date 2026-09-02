import base64
import json
import logging
from cryptography.hazmat.primitives import serialization
from py_vapid import Vapid
from pywebpush import WebPushException, webpush

from core.database import db
from core.security import now_iso

logger = logging.getLogger(__name__)

_VAPID_CACHE: dict | None = None


async def get_or_create_vapid_keys() -> dict:
    global _VAPID_CACHE
    if _VAPID_CACHE:
        return _VAPID_CACHE

    doc = await db.system_settings.find_one({"id": "vapid_keys"}, {"_id": 0})
    if doc and doc.get("public_key") and doc.get("private_pem"):
        _VAPID_CACHE = doc
        return _VAPID_CACHE

    # Generate new VAPID key pair
    v = Vapid()
    v.generate_keys()
    raw_public = v.public_key.public_bytes(
        serialization.Encoding.X962, serialization.PublicFormat.UncompressedPoint
    )
    public_b64 = base64.urlsafe_b64encode(raw_public).decode("utf-8").rstrip("=")
    private_pem = v.private_pem().decode("utf-8")

    key_data = {
        "id": "vapid_keys",
        "public_key": public_b64,
        "private_pem": private_pem,
        "created_at": now_iso(),
    }
    await db.system_settings.update_one(
        {"id": "vapid_keys"}, {"$set": key_data}, upsert=True
    )
    _VAPID_CACHE = key_data
    return key_data


async def get_public_vapid_key() -> str:
    keys = await get_or_create_vapid_keys()
    return keys["public_key"]


async def save_subscription(sub_data: dict, admin_id: str | None = None) -> dict:
    endpoint = sub_data["endpoint"]
    doc = {
        "endpoint": endpoint,
        "keys": sub_data["keys"],
        "device_info": sub_data.get("device_info"),
        "admin_id": admin_id,
        "updated_at": now_iso(),
    }
    await db.push_subscriptions.update_one(
        {"endpoint": endpoint},
        {"$set": doc, "$setOnInsert": {"created_at": now_iso()}},
        upsert=True,
    )
    return {"status": "subscribed", "endpoint": endpoint}


async def remove_subscription(endpoint: str) -> bool:
    res = await db.push_subscriptions.delete_one({"endpoint": endpoint})
    return res.deleted_count > 0


import asyncio

def _send_single_push(subscription_info: dict, payload: str, private_pem: str, vapid_claims: dict) -> None:
    webpush(
        subscription_info=subscription_info,
        data=payload,
        vapid_private_key=private_pem,
        vapid_claims=vapid_claims,
        ttl=86400,
    )


async def send_web_push(title: str, body: str, url: str = "/", badge_count: int = 0) -> dict:
    keys = await get_or_create_vapid_keys()
    subscriptions = await db.push_subscriptions.find({}, {"_id": 0}).to_list(200)

    if not subscriptions:
        return {"sent": 0, "failed": 0, "total": 0, "message": "No push subscribers"}

    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/logo192.png",
        "badge": "/favicon.png",
        "data": {
            "url": url,
            "badgeCount": badge_count,
            "timestamp": now_iso(),
        },
    })

    sent_count = 0
    failed_count = 0
    endpoints_to_remove = []

    vapid_claims = {
        "sub": "mailto:admin@divineyogastudio.in",
    }

    for sub in subscriptions:
        subscription_info = {
            "endpoint": sub["endpoint"],
            "keys": sub["keys"],
        }
        try:
            await asyncio.to_thread(
                _send_single_push,
                subscription_info,
                payload,
                keys["private_pem"],
                vapid_claims,
            )
            sent_count += 1
        except WebPushException as ex:
            # Check for expired/unregistered subscription (410 Gone / 404 Not Found)
            if ex.response and ex.response.status_code in (404, 410):
                endpoints_to_remove.append(sub["endpoint"])
            failed_count += 1
            logger.warning("WebPush failed for subscriber: %s", ex)
        except Exception as ex:
            failed_count += 1
            logger.error("Unexpected error in webpush: %s", ex)


    if endpoints_to_remove:
        await db.push_subscriptions.delete_many({"endpoint": {"$in": endpoints_to_remove}})

    return {
        "sent": sent_count,
        "failed": failed_count,
        "total": len(subscriptions),
        "removed_inactive": len(endpoints_to_remove),
    }
