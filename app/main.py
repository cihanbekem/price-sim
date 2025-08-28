from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from starlette.staticfiles import StaticFiles

from .database import init_db, SessionLocal
from .routers import products, labels, price_changes, push, live, auth
from .services.emulator import EmulatorService
from .services.push_runner import PushRunner

# ---- BURASI KRİTİK: modül seviyesinde, girintisiz olmalı ----
app = FastAPI(title="ESL Python Sim — FastAPI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API router'ları
app.include_router(products.router)
app.include_router(labels.router)
app.include_router(price_changes.router)
app.include_router(push.router)
app.include_router(live.router)
app.include_router(auth.router)

# statik dosyalar
app.mount("/static", StaticFiles(directory="static"), name="static")

# arka plan servisleri
emulator = EmulatorService(success_rate=0.98)
push_runner = PushRunner(SessionLocal, emulator)

@app.on_event("startup")
async def _startup():
    await init_db()
    await push_runner.start()

@app.get("/")
def _root():
    return RedirectResponse(url="/static/index.html")
