from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class VisitPlan(Base):
    """拜访计划"""
    __tablename__ = "tn_visit_plans"
    __table_args__ = (
        Index("idx_vp_tenant_date", "tenant_id", "plan_date"),
        Index("idx_vp_assigned", "assigned_to", "plan_date"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=False, comment="租户ID")
    title = Column(String(200), nullable=False, comment="计划标题")
    plan_date = Column(Date, nullable=False, comment="计划日期")
    assigned_to = Column(Integer, ForeignKey("tn_users.id"), nullable=False, comment="执行人")
    created_by = Column(Integer, ForeignKey("tn_users.id"), nullable=False, comment="创建人")
    status = Column(String(20), default="draft", comment="状态: draft/published/in_progress/completed/cancelled")
    remark = Column(Text, nullable=True, comment="备注")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联
    tasks = relationship("VisitTask", back_populates="plan", cascade="all, delete-orphan")
    assignee = relationship("User", foreign_keys=[assigned_to], backref="visit_plans")
    creator = relationship("User", foreign_keys=[created_by])
