from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, Text, JSON, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class VisitTaskType(Base):
    """拜访任务类型（巡店、陈列检查、终端到货等）"""
    __tablename__ = "tn_visit_task_types"
    __table_args__ = (
        Index("idx_vtt_tenant_id", "tenant_id"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=True, comment="租户ID，NULL为系统预设")
    name = Column(String(100), nullable=False, comment="类型名称")
    code = Column(String(50), nullable=False, comment="类型编码")
    description = Column(Text, nullable=True, comment="描述")
    icon = Column(String(50), nullable=True, comment="图标名称")
    color = Column(String(20), nullable=True, comment="颜色代码")
    is_system = Column(Boolean, default=False, comment="是否系统预设")
    is_active = Column(Boolean, default=True, comment="是否启用")
    sort_order = Column(Integer, default=0, comment="排序")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联
    fields = relationship("VisitTaskTypeField", back_populates="task_type", cascade="all, delete-orphan",
                          order_by="VisitTaskTypeField.sort_order")


class VisitTaskTypeField(Base):
    """任务类型的表单字段"""
    __tablename__ = "tn_visit_task_type_fields"
    __table_args__ = (
        Index("idx_vttf_task_type_id", "task_type_id"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_type_id = Column(Integer, ForeignKey("tn_visit_task_types.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False, comment="字段标签")
    field_key = Column(String(50), nullable=False, comment="字段key")
    field_type = Column(String(20), nullable=False, comment="字段类型: text/number/select/multi_select/photo/rating/boolean")
    options = Column(JSON, nullable=True, comment="选项配置")
    is_required = Column(Boolean, default=False, comment="是否必填")
    sort_order = Column(Integer, default=0, comment="排序")

    # 关联
    task_type = relationship("VisitTaskType", back_populates="fields")
