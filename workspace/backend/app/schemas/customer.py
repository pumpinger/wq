from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime
from decimal import Decimal


class CustomerFieldValueCreate(BaseModel):
    field_id: int
    value: Any


class CustomerFieldValueResponse(BaseModel):
    id: int
    field_id: int
    value: Any

    class Config:
        from_attributes = True


class CustomerCreate(BaseModel):
    name: str
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    managed_by: Optional[int] = None
    template_id: int
    field_values: List[CustomerFieldValueCreate] = []


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    managed_by: Optional[int] = None
    field_values: Optional[List[CustomerFieldValueCreate]] = None


class CustomerResponse(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    managed_by: Optional[int] = None
    template_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerDetail(CustomerResponse):
    field_values: List[CustomerFieldValueResponse] = []
