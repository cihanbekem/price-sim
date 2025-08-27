from __future__ import annotations
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Set

router = APIRouter(prefix="/live", tags=["live"])

class WSManager:
    def __init__(self) -> None:
        self.connections: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.connections.add(ws)

    def disconnect(self, ws: WebSocket):
        self.connections.discard(ws)

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
            await ws.receive_text()  # keepalive/ping
    except WebSocketDisconnect:
        manager.disconnect(ws)
