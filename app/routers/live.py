from __future__ import annotations
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Set
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_session
from .. import models
import os


router = APIRouter(prefix="/live", tags=["live"])

class WSManager:
    def __init__(self) -> None:
        self.connections: Set[WebSocket] = set()
        self.usernames: dict[WebSocket, str] = {}

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.add(ws)

    def disconnect(self, ws: WebSocket):
        self.connections.discard(ws)
        self.usernames.pop(ws, None)

    async def broadcast_json(self, data):
        to_drop = []
        for ws in self.connections:
            try:
                await ws.send_json(data)
            except Exception:
                to_drop.append(ws)
        for ws in to_drop:
            self.disconnect(ws)

manager = WSManager()

@router.websocket("/ws")
async def ws_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            msg = await ws.receive_text()
            try:
                import json
                data = json.loads(msg)
                if isinstance(data, dict) and data.get("type") == "hello" and data.get("user"):
                    manager.usernames[ws] = str(data["user"])[:80]
                    await manager.broadcast_json({
                        "type": "active-users",
                        "users": sorted(set(manager.usernames.values())),
                    })
            except Exception:
                pass
    except WebSocketDisconnect:
        manager.disconnect(ws)

@router.get("/db-snapshot")
async def db_snapshot(session: AsyncSession = Depends(get_session)):
    # Prod'da kapatmak istersen ENV ile koru:
    if os.getenv("LIVE_DEBUG_DB") not in {"1", "true", "True"}:
        # geliştirmede aç:  LIVE_DEBUG_DB=1 uvicorn ...
        raise HTTPException(403, "DB snapshot disabled")

    prods = (await session.execute(select(models.Product))).scalars().all()
    labels = (await session.execute(select(models.ShelfLabel))).scalars().all()
    assigns = (await session.execute(select(models.LabelAssignment))).scalars().all()
    reqs = (await session.execute(select(models.PriceChangeRequest))).scalars().all()
    jobs = (await session.execute(select(models.PushJob))).scalars().all()

    def fprice(x): 
        try: return float(x) if x is not None else None
        except: return None

    return {
        "products": [
            {"id": p.id, "sku": p.sku, "name": p.name,
             "base_price": fprice(p.base_price), "currency": p.currency}
            for p in prods
        ],
        "labels": [
            {"id": l.id, "label_code": l.label_code, "store": l.store,
             "status": l.status, "battery_pct": l.battery_pct}
            for l in labels
        ],
        "assignments": [
            {"label_id": a.label_id, "product_id": a.product_id}
            for a in assigns
        ],
        "price_requests": [
            {"id": r.id, "product_id": r.product_id, "store": r.store,
             "new_price": fprice(r.new_price), "status": r.status}
            for r in reqs
        ],
        "push_jobs": [
            {"id": j.id, "request_id": j.request_id, "label_id": j.label_id,
             "status": j.status, "try_count": j.try_count}
            for j in jobs
        ],
    }


