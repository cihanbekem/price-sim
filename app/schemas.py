from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from typing import Optional, List
from pydantic import BaseModel, EmailStr



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


class PriceHistoryOut(BaseModel):
    id: int
    product_id: str
    store: str
    old_price: Optional[float] = None
    new_price: float
    source_request_id: Optional[str] = None
    changed_by: Optional[str] = None
    changed_at: datetime

    class Config:
        orm_mode = True


# Pydantic v1/v2 uyumluluk (v2'de from_attributes, v1'de orm_mode)
try:
    from pydantic import ConfigDict
    _MODEL_CONFIG = ("v2", ConfigDict(from_attributes=True))
except Exception:
    _MODEL_CONFIG = ("v1", None)

class PriceHistoryOut(BaseModel):
    id: int
    product_id: str
    store: str
    old_price: Optional[float] = None
    new_price: float
    source_request_id: Optional[str] = None
    changed_by: Optional[str] = None
    changed_at: datetime

    if _MODEL_CONFIG[0] == "v2":
        model_config = _MODEL_CONFIG[1]
    else:
        class Config:
            orm_mode = True

class SignupIn(BaseModel):
    email: EmailStr
    worker_no: str
    full_name: str
    password: str

class LoginIn(BaseModel):
    worker_no: str
    full_name: str | None = None
    password: str

class AuthOut(BaseModel):
    token: str