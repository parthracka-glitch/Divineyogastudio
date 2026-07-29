import os
import sys
import time
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

ROOT_DIR = Path(__file__).parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / ".env")

from core.database import client, create_indexes
from routers.admin import router as admin_router
from routers.auth import router as auth_router
from routers.finance import router as finance_router
from routers.reminders import admin_router as reminder_admin_router
from routers.reminders import router as reminder_router
from services.reminders import run_daily_reminders
from services.seed import seed_data

requests_by_ip: dict[str, deque[float]] = defaultdict(deque)
try:
    scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")
except Exception:
    scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(_: FastAPI):
    try:
        await create_indexes()
        await seed_data()
    except Exception as err:
        print(f"[Startup Warning] Database index/seed check: {err}")
    try:
        scheduler.add_job(run_daily_reminders, "cron", hour=8, minute=0, id="daily-payment-reminders", replace_existing=True)
        scheduler.start()
    except Exception as err:
        print(f"[Startup Warning] Scheduler: {err}")
    yield
    try:
        scheduler.shutdown(wait=False)
    except Exception:
        pass
    client.close()


raw_cors = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
cors_origins = [origin.strip() for origin in raw_cors.split(",") if origin.strip()]

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def security_and_rate_limit(request: Request, call_next):
    ip = request.client.host if request.client else "unknown"
    now = time.monotonic()
    category = "login" if request.url.path.endswith("/auth/login") else "general"
    bucket = requests_by_ip[f"{ip}:{category}"]
    while bucket and now - bucket[0] > 60:
        bucket.popleft()
    login_limit = 5 if category == "login" else 100
    if len(bucket) >= login_limit:
        return JSONResponse(status_code=429, content={"detail": "Too many requests. Please try again shortly."})
    bucket.append(now)
    response = await call_next(request)
    response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Content-Security-Policy"] = "default-src 'self'; frame-ancestors 'none'; base-uri 'self'"
    return response


@app.exception_handler(Exception)
async def unexpected_error(_: Request, __: Exception):
    return JSONResponse(status_code=500, content={"detail": "Something went wrong. Please try again."})


@app.get("/")
async def root():
    return {"message": "Divine Yoga Studio API is running", "status": "ok"}


@app.get("/health")
async def health():
    return {"status": "ok"}


app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(finance_router)
app.include_router(reminder_admin_router)
app.include_router(reminder_router)