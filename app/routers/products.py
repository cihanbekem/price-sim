from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from ..database import get_session
from .. import models
from ..schemas import ProductCreate, ProductOut
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app import models, schemas
from app.database import get_session

router = APIRouter(prefix="/products", tags=["products"])

@router.post("/", response_model=ProductOut)
async def create_product(body: ProductCreate, session: AsyncSession = Depends(get_session)):
    # ID kontrolü
    exists_id = (await session.execute(
        select(models.Product).where(models.Product.id == body.id)
    )).scalar_one_or_none()
    if exists_id:
        raise HTTPException(400, "Product id already exists")

    # SKU kontrolü
    exists_sku = (await session.execute(
        select(models.Product).where(models.Product.sku == body.sku)
    )).scalar_one_or_none()
    if exists_sku:
        raise HTTPException(400, "SKU already exists")

    prod = models.Product(
        id=body.id, sku=body.sku, name=body.name,
        base_price=body.base_price, currency=body.currency
    )
    session.add(prod)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        # yarış durumu vs. olursa yine 400 verelim
        raise HTTPException(400, "Duplicate product id or sku")

    return ProductOut.model_validate({
        "id": prod.id, "sku": prod.sku, "name": prod.name,
        "base_price": prod.base_price, "currency": prod.currency
    })

@router.get("/", response_model=list[ProductOut])
async def list_products(session: AsyncSession = Depends(get_session)):
    res = await session.execute(select(models.Product))
    items = res.scalars().all()
    return [ProductOut.model_validate({
        "id": p.id, "sku": p.sku, "name": p.name,
        "base_price": p.base_price, "currency": p.currency
    }) for p in items]

@router.get("/next-id")
async def next_product_id(session: AsyncSession = Depends(get_session)):
    from sqlalchemy import func, cast, Integer
    from sqlalchemy import select
    n = (await session.execute(
        select(func.coalesce(
            func.max(cast(func.substr(models.Product.id, func.instr(models.Product.id, '-') + 1), Integer)), 0
        ))
    )).scalar_one()
    return {"id": f"p-{n+1}"}

@router.get("/{product_id}/price-history", response_model=List[schemas.PriceHistoryOut])
async def get_price_history(
    product_id: str,
    store: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    q = select(models.PriceHistory).where(models.PriceHistory.product_id == product_id)
    if store:
        q = q.where(models.PriceHistory.store == store)
    q = q.order_by(models.PriceHistory.changed_at.desc()).limit(limit)
    res = await session.execute(q)
    return res.scalars().all()
