from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime

from .field_definition import FieldDefinitionResponse


class TemplateFieldCreate(BaseModel):
    field_id: int
    is_required: bool = False
    sort_order: int = 0
    options: Optional[List[str]] = None  # 该模板中此字段的选项值


class TemplateFieldResponse(BaseModel):
    id: int
    field_id: int
    is_required: bool
    sort_order: int
    options: Optional[List[str]] = None  # 该模板中此字段的选项值
    field: FieldDefinitionResponse

    class Config:
        from_attributes = True


class CustomerTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: bool = False
    fields: List[TemplateFieldCreate] = []


class CustomerTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    fields: Optional[List[TemplateFieldCreate]] = None


class CustomerTemplateResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CustomerTemplateDetail(CustomerTemplateResponse):
    template_fields: List[TemplateFieldResponse] = []
