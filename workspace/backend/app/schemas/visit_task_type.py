from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime


class TaskTypeFieldCreate(BaseModel):
    name: str
    field_key: str
    field_type: str  # text/number/select/multi_select/photo/rating/boolean
    options: Optional[Any] = None
    is_required: bool = False
    sort_order: int = 0


class TaskTypeFieldUpdate(BaseModel):
    name: Optional[str] = None
    field_key: Optional[str] = None
    field_type: Optional[str] = None
    options: Optional[Any] = None
    is_required: Optional[bool] = None
    sort_order: Optional[int] = None


class TaskTypeFieldResponse(BaseModel):
    id: int
    name: str
    field_key: str
    field_type: str
    options: Optional[Any] = None
    is_required: bool
    sort_order: int

    class Config:
        from_attributes = True


class TaskTypeCreate(BaseModel):
    name: str
    code: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: bool = True
    sort_order: int = 0
    fields: List[TaskTypeFieldCreate] = []


class TaskTypeUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None
    fields: Optional[List[TaskTypeFieldCreate]] = None


class TaskTypeResponse(BaseModel):
    id: int
    tenant_id: Optional[int] = None
    name: str
    code: str
    description: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_system: bool
    is_active: bool
    sort_order: int
    created_at: datetime

    class Config:
        from_attributes = True


class TaskTypeDetail(TaskTypeResponse):
    fields: List[TaskTypeFieldResponse] = []
