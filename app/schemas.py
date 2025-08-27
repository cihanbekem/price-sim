from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel

class ProductCreate(BaseModel):
    id: str
    sku: str
    name: str
    base_price: Decimal
    currency: str = "TRY"

class ProductOut(BaseModel):
    id: str
    sku: str
    name: str
    base_price: Decimal
    currency: str

class LabelCreate(BaseModel):
    id: str
    label_code: str
    store: str

class LabelOut(BaseModel):
    id: str
    label_code: str
    store: str
    battery_pct: int
    status: str

class AssignRequest(BaseModel):
    label_id: str
    product_id: str

class PriceChangeCreate(BaseModel):
    id: str
    product_id: str
    store: str
    new_price: Decimal
    reason: str | None = None
    scheduled_at: datetime | None = None

class ApprovalIn(BaseModel):
    approver: str
    decision: str  # APPROVE / REJECT
    comment: str | None = None
