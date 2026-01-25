from sqlalchemy import Column, Integer, String, Boolean, JSON, DateTime, Enum, ForeignKey
from sqlalchemy.sql import func
import enum

from ..database import Base


class FieldType(str, enum.Enum):
    TEXT = "text"
    NUMBER = "number"
    DATE = "date"
    SELECT = "select"
    MULTI_SELECT = "multi_select"


class FieldDefinition(Base):
    __tablename__ = "tn_field_definitions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="字段名称")
    field_key = Column(String(50), nullable=False, comment="字段键名")
    field_type = Column(Enum(FieldType), nullable=False, comment="字段类型")
    options = Column(JSON, nullable=True, comment="选项值（用于select/multi_select）")
    is_system = Column(Boolean, default=False, comment="是否系统预设字段")
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=True, comment="所属租户，NULL表示系统字段")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
