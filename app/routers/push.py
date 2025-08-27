from __future__ import annotations
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_session
from .. import models

router = APIRouter(prefix="/push", tags=["push"])

@router.post("/{req_id}/start")
async def start_push(req_id: str, session: AsyncSession = Depends(get_session)):
    req = (await session.execute(
        select(models.PriceChangeRequest).where(models.PriceChangeRequest.id == req_id)
    )).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Request not found")
    if req.status != "APPROVED":
        raise HTTPException(400, "Request not approved")

    q = (select(models.LabelAssignment, models.ShelfLabel)
         .join(models.ShelfLabel, models.ShelfLabel.id == models.LabelAssignment.label_id)
         .where(models.ShelfLabel.store == req.store,
                models.LabelAssignment.product_id == req.product_id))
    rows = (await session.execute(q)).all()
    if not rows:
        raise HTTPException(400, "No labels assigned for this product in given store")

    for la, label in rows:
        job = models.PushJob(
            id=f"job-{req.id}-{label.id}",
            request_id=req.id,
            label_id=label.id,
            status="QUEUED",
            next_run_at=datetime.utcnow(),
        )
        session.add(job)
    await session.commit()
    return {"ok": True, "jobs": len(rows)}

@router.get("/jobs")
async def list_jobs(session: AsyncSession = Depends(get_session)):
    res = await session.execute(select(models.PushJob))
    jobs = res.scalars().all()
    return [{
        "id": j.id, "status": j.status, "try_count": j.try_count,
        "label_id": j.label_id, "request_id": j.request_id
    } for j in jobs]
