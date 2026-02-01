from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Date, Time, Text, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class VisitTask(Base):
    """拜访任务"""
    __tablename__ = "tn_visit_tasks"
    __table_args__ = (
        Index("idx_vt_assigned_date", "assigned_to", "planned_date", "status"),
        Index("idx_vt_customer", "customer_id"),
        Index("idx_vt_tenant", "tenant_id"),
        {"extend_existing": True},
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=False, comment="租户ID")
    plan_id = Column(Integer, ForeignKey("tn_visit_plans.id", ondelete="SET NULL"), nullable=True, comment="所属计划")
    customer_id = Column(Integer, ForeignKey("tn_customers.id"), nullable=False, comment="客户")
    task_type_id = Column(Integer, ForeignKey("tn_visit_task_types.id"), nullable=False, comment="任务类型")
    assigned_to = Column(Integer, ForeignKey("tn_users.id"), nullable=False, comment="执行人")
    status = Column(String(20), default="pending", comment="状态: pending/checked_in/completed/cancelled/expired")
    priority = Column(String(10), default="normal", comment="优先级: low/normal/high/urgent")
    planned_date = Column(Date, nullable=False, comment="计划日期")
    due_time = Column(Time, nullable=True, comment="截止时间")
    remark = Column(Text, nullable=True, comment="备注")
    sort_order = Column(Integer, default=0, comment="排序")
    created_by = Column(Integer, ForeignKey("tn_users.id"), nullable=False, comment="创建人")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联
    plan = relationship("VisitPlan", back_populates="tasks")
    customer = relationship("Customer", backref="visit_tasks")
    task_type = relationship("VisitTaskType", backref="tasks")
    assignee = relationship("User", foreign_keys=[assigned_to], backref="assigned_visit_tasks")
    creator = relationship("User", foreign_keys=[created_by])
    record = relationship("VisitRecord", back_populates="task", uselist=False)
