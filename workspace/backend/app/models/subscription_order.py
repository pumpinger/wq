"""
订阅订单模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Date, Boolean, ForeignKey, Enum, Text, Numeric, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..database import Base


class SubscriptionOrder(Base):
    __tablename__ = "tn_subscription_orders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    order_no = Column(String(50), unique=True, nullable=False, comment="订单号")
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=True, comment="租户ID(null=新建租户)")
    tenant_name = Column(String(100), nullable=False, comment="租户名称(冗余)")
    modules = Column(JSON, nullable=False, comment='模块开关 {"customer":true,"attendance":true,"visit":false}')
    max_users = Column(Integer, default=10, comment="最大用户数")
    amount = Column(Numeric(10, 2), default=0, comment="订阅金额")
    start_date = Column(Date, nullable=False, comment="开始日期")
    end_date = Column(Date, nullable=False, comment="结束日期")
    status = Column(
        Enum("pending", "active", "expired", "cancelled", name="subscription_status"),
        default="pending",
        comment="状态"
    )
    remark = Column(Text, nullable=True, comment="备注")
    activated_at = Column(DateTime, nullable=True, comment="激活时间")
    created_by = Column(Integer, ForeignKey("tn_users.id"), nullable=False, comment="创建人")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联
    tenant = relationship("Tenant", backref="subscription_orders")
    creator = relationship("User", foreign_keys=[created_by])
