from __future__ import annotations
import asyncio
from datetime import datetime, timedelta
from statistics import mean
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from ..models import PushJob, PriceChangeRequest, Product, ShelfLabel
from .emulator import EmulatorService
from ..routers.live import manager

MAX_RETRY = 3

class PushRunner:
    def __init__(self, session_factory, emulator: EmulatorService):
        self.session_factory = session_factory
        self.emulator = emulator
        self._task: Optional[asyncio.Task] = None
        self._durations: list[int] = []

    async def start(self):
        if not self._task:
            self._task = asyncio.create_task(self._run())

    async def _run(self):
        while True:
            async with self.session_factory() as session:
                now = datetime.utcnow()
                q = (select(PushJob)
                     .where(
                        (PushJob.status.in_(["QUEUED"])) |
                        ((PushJob.status == "PROCESSING") & (PushJob.next_run_at <= now)) |
                        ((PushJob.status == "QUEUED") & ((PushJob.next_run_at == None) | (PushJob.next_run_at <= now)))
                     )
                     .order_by(PushJob.updated_at)
                     .limit(1))
                job = (await session.execute(q)).scalar_one_or_none()

                if not job:
                    await self._broadcast_metrics(session)
                    await asyncio.sleep(0.4)
                    continue

                job.status = "PROCESSING"
                job.updated_at = now
                await session.commit()

                # ilgili kayıtları çek
                req = (await session.execute(select(PriceChangeRequest).where(PriceChangeRequest.id == job.request_id))).scalar_one()
                prod = (await session.execute(select(Product).where(Product.id == req.product_id))).scalar_one()
                label = (await session.execute(select(ShelfLabel).where(ShelfLabel.id == job.label_id))).scalar_one()

                start = datetime.utcnow()
                ok = await self.emulator.set_price(session, label.id, prod.sku, float(req.new_price))
                dur_ms = int((datetime.utcnow() - start).total_seconds() * 1000)
                self._durations.append(dur_ms)

                if ok:
                    job.status = "SUCCESS"
                    job.updated_at = datetime.utcnow()
                    await session.commit()
                else:
                    job.try_count += 1
                    if job.try_count >= MAX_RETRY:
                        job.status = "FAILED"
                        job.updated_at = datetime.utcnow()
                        job.last_error = "Emulator NACK"
                        await session.commit()
                    else:
                        delay = 2 ** job.try_count
                        job.status = "QUEUED"
                        job.next_run_at = datetime.utcnow() + timedelta(seconds=delay)
                        job.updated_at = datetime.utcnow()
                        await session.commit()

                await self._broadcast_metrics(session)

    async def _broadcast_metrics(self, session: AsyncSession):
        total = (await session.execute(select(PushJob))).scalars().all()
        success = sum(1 for j in total if j.status == "SUCCESS")
        failed = sum(1 for j in total if j.status == "FAILED")
        queued = sum(1 for j in total if j.status == "QUEUED")
        processing = sum(1 for j in total if j.status == "PROCESSING")
        avg_ack_ms = int(mean(self._durations)) if self._durations else None
        await manager.broadcast_json({
            "type": "metrics",
            "total": len(total),
            "success": success,
            "failed": failed,
            "queued": queued,
            "processing": processing,
            "avg_ack_ms": avg_ack_ms,
        })
