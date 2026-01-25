"""
客户公海记录模型
记录客户进出公海的历史
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..database import Base


class CustomerPoolRecord(Base):
    """客户公海记录表"""
    __tablename__ = "tn_customer_pool_records"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    customer_id = Column(Integer, ForeignKey("tn_customers.id", ondelete="CASCADE"), nullable=False, comment="客户ID")
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id", ondelete="CASCADE"), nullable=False, comment="租户ID")
    action = Column(
        Enum("release", "claim", "auto_reclaim", name="pool_action_type"),
        nullable=False,
        comment="操作类型: release-释放, claim-认领, auto_reclaim-自动回收"
    )
    from_user_id = Column(Integer, ForeignKey("tn_users.id", ondelete="SET NULL"), nullable=True, comment="原负责人")
    to_user_id = Column(Integer, ForeignKey("tn_users.id", ondelete="SET NULL"), nullable=True, comment="新负责人")
    reason = Column(String(500), nullable=True, comment="原因说明")
    created_at = Column(DateTime, server_default=func.now(), comment="操作时间")

    # 关联
    customer = relationship("Customer", backref="pool_records")
