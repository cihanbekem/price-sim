from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from ..database import get_session
from .. import models
from ..schemas import LabelCreate, LabelOut, AssignRequest

router = APIRouter(prefix="/labels", tags=["labels"])

@router.post("/", response_model=LabelOut)
async def create_label(body: LabelCreate, session: AsyncSession = Depends(get_session)):
    # id kontrolü
    if (await session.execute(
        select(models.ShelfLabel).where(models.ShelfLabel.id == body.id)
    )).scalar_one_or_none():
        raise HTTPException(400, "Label id exists")

    # label_code kontrolü
    if (await session.execute(
        select(models.ShelfLabel).where(models.ShelfLabel.label_code == body.label_code)
    )).scalar_one_or_none():
        raise HTTPException(400, "label_code already exists")

    lbl = models.ShelfLabel(id=body.id, label_code=body.label_code, store=body.store)
    session.add(lbl)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        raise HTTPException(400, "Duplicate label id or label_code")

    return LabelOut.model_validate({
        "id": lbl.id, "label_code": lbl.label_code, "store": lbl.store,
        "battery_pct": lbl.battery_pct, "status": lbl.status
    })

@router.get("/", response_model=list[LabelOut])
async def list_labels(session: AsyncSession = Depends(get_session)):
    res = await session.execute(select(models.ShelfLabel))
    items = res.scalars().all()
    return [LabelOut.model_validate({
        "id": l.id, "label_code": l.label_code, "store": l.store,
        "battery_pct": l.battery_pct, "status": l.status
    }) for l in items]

# trailing slash sorun olmasın diye iki route:
@router.post("/assign")
@router.post("/assign/")
async def assign_label(body: AssignRequest, session: AsyncSession = Depends(get_session)):
    prod = (await session.execute(
        select(models.Product).where(models.Product.id == body.product_id)
    )).scalar_one_or_none()
    lbl = (await session.execute(
        select(models.ShelfLabel).where(models.ShelfLabel.id == body.label_id)
    )).scalar_one_or_none()
    if not prod or not lbl:
        raise HTTPException(404, "Product or Label not found")

    exists = (await session.execute(select(models.LabelAssignment).where(
        (models.LabelAssignment.label_id == body.label_id) &
        (models.LabelAssignment.product_id == body.product_id)
    ))).scalar_one_or_none()

    if not exists:
        session.add(models.LabelAssignment(label_id=body.label_id, product_id=body.product_id))
        await session.commit()
    return {"ok": True}
