from __future__ import annotations
from datetime import datetime
from decimal import Decimal
from sqlalchemy import String, Integer, ForeignKey, Numeric, DateTime, UniqueConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey

class User(Base):
    __tablename__ = "user"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    provider: Mapped[str] = mapped_column(String, default="local")  # local/google
    employee_no: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Product(Base):
    __tablename__ = "product"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    sku: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    base_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    currency: Mapped[str] = mapped_column(String, default="TRY")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    assignments: Mapped[list["LabelAssignment"]] = relationship(back_populates="product")
    price_requests: Mapped[list["PriceChangeRequest"]] = relationship(back_populates="product")

class ShelfLabel(Base):
    __tablename__ = "shelf_label"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    label_code: Mapped[str] = mapped_column(String, unique=True, index=True)
    store: Mapped[str] = mapped_column(String, index=True)
    battery_pct: Mapped[int] = mapped_column(Integer, default=95)
    status: Mapped[str] = mapped_column(String, default="ONLINE")
    last_seen: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    assignments: Mapped[list["LabelAssignment"]] = relationship(back_populates="label")

class LabelAssignment(Base):
    __tablename__ = "label_assignment"
    label_id: Mapped[str] = mapped_column(ForeignKey("shelf_label.id"), primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("product.id"), primary_key=True)
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    label: Mapped["ShelfLabel"] = relationship(back_populates="assignments")
    product: Mapped["Product"] = relationship(back_populates="assignments")
    __table_args__ = (UniqueConstraint("label_id", "product_id", name="uq_label_product"),)

class PriceChangeRequest(Base):
    __tablename__ = "price_change_request"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("product.id"))
    store: Mapped[str] = mapped_column(String, index=True)
    old_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    new_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    status: Mapped[str] = mapped_column(String, default="PENDING")
    reason: Mapped[str | None] = mapped_column(String, nullable=True)
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    product: Mapped["Product"] = relationship(back_populates="price_requests")
    approvals: Mapped[list["Approval"]] = relationship(back_populates="request")
    push_jobs: Mapped[list["PushJob"]] = relationship(back_populates="request")

class Approval(Base):
    __tablename__ = "approval"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("price_change_request.id"))
    approver: Mapped[str] = mapped_column(String)
    decision: Mapped[str] = mapped_column(String)  # APPROVE / REJECT
    comment: Mapped[str | None] = mapped_column(String, nullable=True)
    decided_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    request: Mapped["PriceChangeRequest"] = relationship(back_populates="approvals")

class PushJob(Base):
    __tablename__ = "push_job"
    id: Mapped[str] = mapped_column(String, primary_key=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("price_change_request.id"))
    label_id: Mapped[str] = mapped_column(ForeignKey("shelf_label.id"))
    try_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String, default="QUEUED")  # QUEUED, PROCESSING, SUCCESS, FAILED
    last_error: Mapped[str | None] = mapped_column(String, nullable=True)
    next_run_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    request: Mapped["PriceChangeRequest"] = relationship(back_populates="push_jobs")

class PriceHistory(Base):
    __tablename__ = "price_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    product_id = Column(String, ForeignKey("product.id"), nullable=False, index=True)
    store = Column(String, nullable=False, index=True)
    old_price = Column(Float)
    new_price = Column(Float, nullable=False)
    source_request_id = Column(String, ForeignKey("price_change_request.id"), nullable=True, index=True)
    changed_by = Column(String, nullable=True)  # örn: "system/push" veya onaylayan kullanıcı
    changed_at = Column(DateTime, nullable=False, default=datetime.utcnow)

Index("ix_push_job_next", PushJob.next_run_at)
