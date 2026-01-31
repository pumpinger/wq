from pydantic import BaseModel
from typing import Optional, Dict, Any, List, Literal
from datetime import datetime
from decimal import Decimal
from enum import Enum


class CustomFieldFilterOperator(str, Enum):
    """自定义字段筛选操作符"""
    EQ = "eq"              # 精确匹配（select）
    CONTAINS = "contains"  # 模糊匹配（text）
    GTE = "gte"            # 大于等于（number/date）
    LTE = "lte"            # 小于等于（number/date）
    IN = "in"              # 包含任意一个（multi_select）


class CustomFieldFilter(BaseModel):
    """自定义字段筛选条件"""
    field_id: int
    operator: CustomFieldFilterOperator
    value: Any


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
    region_id: Optional[int] = None
    field_values: List[CustomerFieldValueCreate] = []


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    managed_by: Optional[int] = None
    region_id: Optional[int] = None
    field_values: Optional[List[CustomerFieldValueCreate]] = None


class CustomerResponse(BaseModel):
    id: int
    name: str
    address: Optional[str] = None
    latitude: Optional[Decimal] = None
    longitude: Optional[Decimal] = None
    managed_by: Optional[int] = None
    template_id: Optional[int] = None
    region_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerDetail(CustomerResponse):
    field_values: List[CustomerFieldValueResponse] = []
