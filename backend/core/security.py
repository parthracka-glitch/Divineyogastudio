import base64
import hashlib
import html
import os
from datetime import datetime, timedelta, timezone

import jwt
from argon2 import PasswordHasher
from cryptography.fernet import Fernet
from fastapi import HTTPException, Request, status


password_hasher = PasswordHasher()
JWT_ALGORITHM = "HS256"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except Exception:
        return False


def token_for(user_id: str, email: str, token_type: str, minutes: int) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "type": token_type,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=minutes),
    }
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def decode_token(token: str, expected_type: str) -> dict:
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session is invalid or expired") from exc
    if payload.get("type") != expected_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session type")
    return payload


def requester_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def encryption_box() -> Fernet:
    material = hashlib.sha256(os.environ["FIELD_ENCRYPTION_SECRET"].encode()).digest()
    return Fernet(base64.urlsafe_b64encode(material))


def encrypt_text(value: str | None) -> str | None:
    if not value:
        return value
    return encryption_box().encrypt(value.encode()).decode()


def decrypt_text(value: str | None) -> str | None:
    if not value:
        return value
    try:
        return encryption_box().decrypt(value.encode()).decode()
    except Exception:
        return None


def safe_template_value(value: object) -> str:
    return html.escape(str(value), quote=True)