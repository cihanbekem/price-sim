from __future__ import annotations
import asyncio, random
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..models import ShelfLabel

class EmulatorService:
    def __init__(self, success_rate: float = 0.98, min_delay: float = 0.5, max_delay: float = 1.8):
        self.success_rate = success_rate
        self.min_delay = min_delay
        self.max_delay = max_delay

    async def set_price(self, session: AsyncSession, label_id: str, sku: str, price: float) -> bool:
        await asyncio.sleep(random.uniform(self.min_delay, self.max_delay))
        success = random.random() < self.success_rate

        # label sağlık güncellemesi
        res = await session.execute(select(ShelfLabel).where(ShelfLabel.id == label_id))
        label = res.scalar_one_or_none()
        if label:
            label.last_seen = datetime.utcnow()
            label.battery_pct = max(1, label.battery_pct - (0 if success else 1))
            await session.commit()

        return success
