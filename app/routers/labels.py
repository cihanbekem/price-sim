from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError
from ..database import get_session
from .. import models
from ..schemas import LabelCreate, LabelOut, AssignRequest
from .live import manager  # <<< canlı yayın

router = APIRouter(prefix="/labels", tags=["labels"])

@router.delete("/{label_id}")
async def delete_label(label_id: str, session: AsyncSession = Depends(get_session)):
    lab = (await session.execute(
        select(models.ShelfLabel).where(models.ShelfLabel.id == label_id)
    )).scalar_one_or_none()
    if not lab:
        raise HTTPException(404, "Label not found")
    # önce ilişkili kayıtları sil (FK hatasını önlemek için)
    await session.execute(delete(models.LabelAssignment).where(models.LabelAssignment.label_id == label_id))
    await session.execute(delete(models.PushJob).where(models.PushJob.label_id == label_id))
    await session.delete(lab)
    await session.commit()
    # canlı: etiket silindi yayını
    await manager.broadcast_json({
        "type": "label-deleted",
        "label_id": label_id
    })
    return {"ok": True}

@router.post("/", response_model=LabelOut)
async def create_label(body: LabelCreate, session: AsyncSession = Depends(get_session)):
    # id
    if (await session.execute(
        select(models.ShelfLabel).where(models.ShelfLabel.id == body.id)
    )).scalar_one_or_none():
        raise HTTPException(400, "Label id exists")
    # label_code
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

    # canlı: yeni etiket
    await manager.broadcast_json({
        "type": "label-created",
        "label": {
            "id": lbl.id, "label_code": lbl.label_code, "store": lbl.store,
            "battery_pct": lbl.battery_pct, "status": lbl.status,
        }
    })
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

# trailing slash desteği
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

    # canlı: etiketin üzerine ürün yaz
    await manager.broadcast_json({
        "type": "label-updated",
        "label_id": body.label_id,
        "product": {
            "id": prod.id, "name": prod.name,
            "price": float(prod.base_price), "currency": prod.currency
        }
    })
    return {"ok": True}



# Etiket Duvarı (ilk yükleme için birleşik görünüm)
@router.get("/wall")
async def labels_wall(session: AsyncSession = Depends(get_session)):
    q = (
        select(models.ShelfLabel, models.Product)
        .join(models.LabelAssignment, models.LabelAssignment.label_id == models.ShelfLabel.id, isouter=True)
        .join(models.Product, models.Product.id == models.LabelAssignment.product_id, isouter=True)
    )
    rows = (await session.execute(q)).all()
    out = []
    for lbl, prod in rows:
        out.append({
            "label": {
                "id": lbl.id, "label_code": lbl.label_code, "store": lbl.store,
                "battery_pct": lbl.battery_pct, "status": lbl.status
            },
            "product": None if prod is None else {
                "id": prod.id, "name": prod.name,
                "price": float(prod.base_price), "currency": prod.currency
            }
        })
    return out
