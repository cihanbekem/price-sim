from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ..database import get_session
from .. import models
from ..schemas import PriceChangeCreate, ApprovalIn

router = APIRouter(prefix="/price-changes", tags=["price-changes"])

@router.get("/next-id")
async def get_next_id(session: AsyncSession = Depends(get_session)):
    # Find the highest existing ID and suggest the next one
    result = await session.execute(
        select(func.max(models.PriceChangeRequest.id))
    )
    max_id = result.scalar()
    
    if not max_id:
        return {"id": "req-1"}
    
    # Extract number from ID like "req-123" and increment
    try:
        parts = max_id.split("-")
        if len(parts) >= 2:
            num = int(parts[-1]) + 1
            return {"id": f"{parts[0]}-{num}"}
    except (ValueError, IndexError):
        pass
    
    return {"id": "req-1"}

@router.post("/")
async def create_price_change(
    body: PriceChangeCreate,
    session: AsyncSession = Depends(get_session),
):
    prod = (
        await session.execute(
            select(models.Product).where(models.Product.id == body.product_id)
        )
    ).scalar_one_or_none()
    if not prod:
        raise HTTPException(404, "Product not found")

    req = models.PriceChangeRequest(
        id=body.id,
        product_id=body.product_id,
        store=body.store,
        old_price=prod.base_price,
        new_price=body.new_price,
        status="PENDING",
        reason=body.reason,
        scheduled_at=body.scheduled_at,
    )
    session.add(req)
    await session.commit()
    return {"ok": True, "id": req.id}

@router.post("/{req_id}/approve")
async def approve_price_change(
    req_id: str,
    body: ApprovalIn,
    session: AsyncSession = Depends(get_session),
):
    req = (
        await session.execute(
            select(models.PriceChangeRequest).where(models.PriceChangeRequest.id == req_id)
        )
    ).scalar_one_or_none()
    if not req:
        raise HTTPException(404, "Request not found")

    decision = body.decision.upper()
    if decision not in ("APPROVE", "REJECT"):
        raise HTTPException(400, "decision must be APPROVE or REJECT")

    req.status = "APPROVED" if decision == "APPROVE" else "REJECTED"
    session.add(
        models.Approval(
            id=f"appr-{req_id}",
            request_id=req_id,
            approver=body.approver,
            decision=decision,
            comment=body.comment,
        )
    )

    # Not: Fiyatı burada güncellemiyoruz. Push tamamlandığında ürün fiyatı
    # güncellenir ve fiyat geçmişi kaydı o anda oluşturulur.

    await session.commit()
    return {"ok": True, "status": req.status}



