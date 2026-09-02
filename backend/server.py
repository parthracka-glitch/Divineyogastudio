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

from core.database import check_database_health, client, create_indexes
from routers.admin import router as admin_router
from routers.auth import router as auth_router
from routers.finance import router as finance_router
from routers.reminders import admin_router as reminder_admin_router
from routers.reminders import router as reminder_router
from services.reminders import run_daily_reminders
from services.seed import seed_data

requests_by_ip: dict[str, deque[float]] = defaultdict(deque)
_last_prune_time = 0.0

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
        if scheduler.running:
            scheduler.shutdown(wait=False)
    except Exception:
        pass
    try:
        client.close()
    except Exception:
        pass


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
    global _last_prune_time
    now = time.monotonic()

    # Periodic cleanup to prevent unbounded memory growth
    if now - _last_prune_time > 300:
        stale_keys = [k for k, q in list(requests_by_ip.items()) if not q or now - q[-1] > 120]
        for k in stale_keys:
            requests_by_ip.pop(k, None)
        _last_prune_time = now

    ip = request.client.host if request.client else "unknown"
    category = "login" if request.url.path.endswith("/auth/login") else "general"
    key = f"{ip}:{category}"
    bucket = requests_by_ip[key]
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
async def unexpected_error(_: Request, exc: Exception):
    import traceback
    traceback.print_exc()
    env = os.environ.get("ENVIRONMENT", "development").lower()
    if env == "production":
        return JSONResponse(status_code=500, content={"detail": "An internal server error occurred. Please contact the studio administrator."})
    return JSONResponse(status_code=500, content={"detail": f"Database or server error: {str(exc)}"})


@app.get("/")
async def root():
    return {"message": "Divine Yoga Studio API is running", "status": "ok"}


@app.get("/health")
async def health():
    db_health = await check_database_health()
    scheduler_running = bool(scheduler.running)
    is_healthy = db_health.get("connected", False)
    status_code = 200 if is_healthy else 503
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "healthy" if is_healthy else "unhealthy",
            "service": "divine-yoga-backend",
            "database": db_health,
            "scheduler": {
                "running": scheduler_running,
                "active_jobs": [job.id for job in scheduler.get_jobs()] if scheduler_running else [],
            },
            "timestamp": time.time(),
        }
    )



app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(finance_router)
app.include_router(reminder_admin_router)
app.include_router(reminder_router)