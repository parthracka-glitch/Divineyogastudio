import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status


from core.database import db
from core.security import decode_token, hash_password, now_iso, requester_ip, token_for, verify_password
from models.schemas import LoginInput


router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


async def audit(action: str, request: Request, admin_id: str | None = None, metadata: dict | None = None) -> None:
    await db.audit_logs.insert_one({"admin_user_id": admin_id, "action": action, "resource_type": "admin_user", "resource_id": admin_id, "ip_address": requester_ip(request), "user_agent": request.headers.get("user-agent", ""), "timestamp": now_iso(), "metadata": metadata or {}})


async def current_admin(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        authorization = request.headers.get("authorization", "")
        token = authorization.removeprefix("Bearer ") if authorization.startswith("Bearer ") else None
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in is required")
    payload = decode_token(token, "access")
    admin = await db.admin_users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not admin:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is no longer valid")
    return admin


def set_session(response: Response, admin: dict) -> None:
    is_secure = os.environ.get("SECURE_COOKIES", "false").lower() in ("true", "1")
    samesite = "none" if is_secure else "lax"
    response.set_cookie("access_token", token_for(admin["id"], admin["email"], "access", 15), httponly=True, secure=is_secure, samesite=samesite, max_age=900, path="/")
    response.set_cookie("refresh_token", token_for(admin["id"], admin["email"], "refresh", 10080), httponly=True, secure=is_secure, samesite=samesite, max_age=604800, path="/")


@router.post("/login")
async def login(input: LoginInput, response: Response, request: Request):
    email = str(input.email).lower()
    admin = await db.admin_users.find_one({"email": email}, {"_id": 0})
    now = datetime.now(timezone.utc)
    if admin and admin.get("locked_until") and datetime.fromisoformat(admin["locked_until"]) > now:
        await audit("login_locked", request, admin["id"], {"email": email})
        raise HTTPException(status_code=429, detail="Account is temporarily locked. Please try again later.")
    if not admin or not verify_password(input.password, admin["password_hash"]):
        if admin:
            attempts = admin.get("failed_login_attempts", 0) + 1
            changes = {"failed_login_attempts": attempts, "updated_at": now_iso()}
            if attempts >= 5:
                changes["locked_until"] = (now + timedelta(minutes=15)).isoformat()
            await db.admin_users.update_one({"id": admin["id"]}, {"$set": changes})
            await audit("login_failed", request, admin["id"], {"email": email, "attempts": attempts})
        else:
            await audit("login_failed", request, None, {"email": email})
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Email or password is incorrect")
    await db.admin_users.update_one({"id": admin["id"]}, {"$set": {"failed_login_attempts": 0, "locked_until": None, "last_login_at": now_iso(), "updated_at": now_iso()}})
    await audit("login_success", request, admin["id"])
    set_session(response, admin)
    return {"id": admin["id"], "email": admin["email"], "display_name": admin["display_name"]}


@router.get("/me")
async def me(admin: dict = Depends(current_admin)):
    return admin


@router.post("/refresh")
async def refresh(response: Response, request: Request):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Refresh session is missing")
    payload = decode_token(token, "refresh")
    admin = await db.admin_users.find_one({"id": payload["sub"]}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=401, detail="Session is no longer valid")
    set_session(response, admin)
    return {"ok": True}


@router.post("/logout")
async def logout(response: Response, request: Request, admin: dict = Depends(current_admin)):
    await audit("logout", request, admin["id"])
    is_secure = os.environ.get("SECURE_COOKIES", "false").lower() in ("true", "1")
    samesite = "none" if is_secure else "lax"
    response.delete_cookie("access_token", path="/", secure=is_secure, samesite=samesite)
    response.delete_cookie("refresh_token", path="/", secure=is_secure, samesite=samesite)
    return {"ok": True}