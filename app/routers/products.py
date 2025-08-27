from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from ..database import get_session
from .. import models
from ..schemas import ProductCreate, ProductOut

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
