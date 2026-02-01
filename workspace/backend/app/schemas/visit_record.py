from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from decimal import Decimal


class VisitRecordFieldResponse(BaseModel):
    field_key: str
    value: Any

    class Config:
        from_attributes = True


class VisitPhotoResponse(BaseModel):
    id: int
    field_key: Optional[str] = None
    file_path: str
    file_name: Optional[str] = None
    thumbnail_path: Optional[str] = None
    sort_order: int

    class Config:
        from_attributes = True


class VisitRecordResponse(BaseModel):
    id: int
    tenant_id: int
    task_id: Optional[int] = None
    customer_id: int
    customer_name: Optional[str] = None
    user_id: int
    user_name: Optional[str] = None
    task_type_id: int
    task_type_name: Optional[str] = None
    check_in_time: datetime
    check_in_address: Optional[str] = None
    check_in_distance: Optional[int] = None
    check_out_time: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: str
    remark: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class VisitRecordDetail(VisitRecordResponse):
    check_in_lat: Optional[Decimal] = None
    check_in_lng: Optional[Decimal] = None
    check_out_lat: Optional[Decimal] = None
    check_out_lng: Optional[Decimal] = None
    field_values: List[VisitRecordFieldResponse] = []
    photos: List[VisitPhotoResponse] = []


class VisitStatsSummary(BaseModel):
    total_visits: int = 0
    completed_visits: int = 0
    completion_rate: float = 0.0
    avg_duration_minutes: float = 0.0
    total_customers_visited: int = 0


class VisitStatsByUser(BaseModel):
    user_id: int
    user_name: Optional[str] = None
    visit_count: int = 0
    completed_count: int = 0
    avg_duration: float = 0.0
