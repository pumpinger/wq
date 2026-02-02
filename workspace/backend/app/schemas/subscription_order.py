"""
订阅订单 Schema
"""
from typing import Optional, Any
from datetime import date, datetime
from decimal import Decimal
import json
from pydantic import BaseModel, field_validator


class SubscriptionOrderCreate(BaseModel):
    tenant_id: Optional[int] = None
    tenant_name: str
    # 新建租户时需要的信息
    tenant_code: Optional[str] = None
    admin_username: Optional[str] = None
    admin_password: Optional[str] = None
    admin_real_name: Optional[str] = None
    # 订阅信息
    modules: dict  # {"customer": true, "attendance": true, "visit": false}
    max_users: int = 10
    amount: Decimal = Decimal("0")
    start_date: date
    end_date: date
    remark: Optional[str] = None


class SubscriptionOrderUpdate(BaseModel):
    tenant_name: Optional[str] = None
    modules: Optional[dict] = None
    max_users: Optional[int] = None
    amount: Optional[Decimal] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    remark: Optional[str] = None


class SubscriptionOrderResponse(BaseModel):
    id: int
    order_no: str
    tenant_id: Optional[int] = None
    tenant_name: str
    modules: dict

    @field_validator("modules", mode="before")
    @classmethod
    def parse_modules(cls, v: Any) -> dict:
        if isinstance(v, str):
            return json.loads(v)
        return v
    max_users: int
    amount: Decimal
    start_date: date
    end_date: date
    status: str
    remark: Optional[str] = None
    activated_at: Optional[datetime] = None
    created_by: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SubscriptionOrderListResponse(BaseModel):
    items: list[SubscriptionOrderResponse]
    total: int
