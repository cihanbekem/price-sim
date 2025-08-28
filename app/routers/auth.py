from __future__ import annotations
import os, hmac, hashlib, base64
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_session
from ..models import User

router = APIRouter(prefix="/auth", tags=["auth"])

# ---- token & password helpers ----
SECRET = os.getenv("APP_SECRET", os.urandom(32).hex())

try:
    from passlib.hash import bcrypt
except Exception:
    bcrypt = None

def _hash_password(password: str) -> str:
    if bcrypt:
        return bcrypt.hash(password)
    salt = os.getenv("PWD_SALT", "s1")
    return hashlib.sha256((salt + ":" + password).encode()).hexdigest()

def _verify_password(password: str, password_hash: str | None) -> bool:
    if not password_hash:
        return False
    if bcrypt and password_hash.startswith("$2"):
        try:
            return bcrypt.verify(password, password_hash)
        except Exception:
            return False
    return password_hash == _hash_password(password)

def _make_token(user_id: str, minutes: int = 60*24) -> str:
    exp = int((datetime.utcnow() + timedelta(minutes=minutes)).timestamp())
    payload = f"{user_id}.{exp}"
    sig = hmac.new(SECRET.encode(), payload.encode(), hashlib.sha256).digest()
    return payload + "." + base64.urlsafe_b64encode(sig).decode().rstrip("=")


@router.post("/register")
async def register(body: dict, session: AsyncSession = Depends(get_session)):
    email = (body.get("email") or "").strip().lower()
    name = (body.get("name") or email or "User").strip()
    password = body.get("password") or ""
    employee_no = (body.get("employee_no") or None)
    if not email or not password:
        raise HTTPException(400, "email ve password gerekli")
    exists = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if exists:
        raise HTTPException(409, "email zaten kayıtlı")
    u = User(id=f"u-{int(datetime.utcnow().timestamp())}", email=email, name=name,
             password_hash=_hash_password(password), provider="local", employee_no=employee_no)
    session.add(u)
    await session.commit()
    return {"ok": True}


@router.post("/login")
async def login(body: dict, session: AsyncSession = Depends(get_session)):
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    u = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not u or not _verify_password(password, u.password_hash):
        raise HTTPException(401, "geçersiz giriş")
    token = _make_token(u.id)
    return {"token": token, "user": {"id": u.id, "email": u.email, "name": u.name}}


@router.post("/google")
async def google_login(body: dict, session: AsyncSession = Depends(get_session)):
    # Verify Google ID token using google-auth if available
    id_token = body.get("id_token")
    if not id_token:
        raise HTTPException(400, "id_token gerekli")
    email = None
    name = None
    try:
        from google.oauth2 import id_token as g_id_token
        from google.auth.transport import requests as g_requests
        client_id = os.getenv("GOOGLE_CLIENT_ID") or None
        # Eğer client_id verilmemişse audience doğrulamasını kaldır
        if client_id:
            payload = g_id_token.verify_oauth2_token(id_token, g_requests.Request(), audience=client_id)
        else:
            payload = g_id_token.verify_oauth2_token(id_token, g_requests.Request())
        email = (payload.get("email") or "").lower()
        name = payload.get("name") or email or "User"
    except Exception:
        raise HTTPException(401, "Geçersiz Google token")

    u = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if not u:
        u = User(id=f"u-{int(datetime.utcnow().timestamp())}", email=email, name=name, provider="google")
        session.add(u)
        await session.commit()
    token = _make_token(u.id)
    return {"token": token, "user": {"id": u.id, "email": u.email, "name": u.name}}
