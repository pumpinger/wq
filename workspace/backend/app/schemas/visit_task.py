from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import date, time, datetime
from decimal import Decimal


class VisitTaskCreate(BaseModel):
    customer_id: int
    task_type_id: int
    assigned_to: int
    planned_date: date
    priority: str = "normal"
    due_time: Optional[time] = None
    remark: Optional[str] = None


class VisitTaskUpdate(BaseModel):
    customer_id: Optional[int] = None
    task_type_id: Optional[int] = None
    assigned_to: Optional[int] = None
    planned_date: Optional[date] = None
    priority: Optional[str] = None
    due_time: Optional[time] = None
    remark: Optional[str] = None


class CheckInRequest(BaseModel):
    lat: Decimal
    lng: Decimal
    address: Optional[str] = None


class CheckOutRequest(BaseModel):
    lat: Optional[Decimal] = None
    lng: Optional[Decimal] = None


class RecordFieldValue(BaseModel):
    field_key: str
    value: Any


class TaskCompleteRequest(BaseModel):
    field_values: List[RecordFieldValue] = []
    photos: List[str] = []  # file paths from upload
    remark: Optional[str] = None
    check_out_lat: Optional[Decimal] = None
    check_out_lng: Optional[Decimal] = None


class VisitTaskResponse(BaseModel):
    id: int
    tenant_id: int
    plan_id: Optional[int] = None
    customer_id: int
    customer_name: Optional[str] = None
    customer_address: Optional[str] = None
    customer_lat: Optional[Decimal] = None
    customer_lng: Optional[Decimal] = None
    task_type_id: int
    task_type_name: Optional[str] = None
    task_type_color: Optional[str] = None
    task_type_icon: Optional[str] = None
    assigned_to: int
    assignee_name: Optional[str] = None
    status: str
    priority: str
    planned_date: date
    due_time: Optional[time] = None
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
