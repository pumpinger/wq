from pydantic import BaseModel
from typing import Optional, List, Any
from datetime import datetime
from enum import Enum


class FieldType(str, Enum):
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    SELECT = "select"
    MULTI_SELECT = "multi_select"


class FieldDefinitionCreate(BaseModel):
    name: str
    field_key: str
    field_type: FieldType
    options: Optional[List[str]] = None
    is_system: bool = False


class FieldDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    field_type: Optional[FieldType] = None
    options: Optional[List[str]] = None


class FieldDefinitionResponse(BaseModel):
    id: int
    name: str
    field_key: str
    field_type: FieldType
    options: Optional[List[str]] = None
    is_system: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
