"""
区域模型 + 用户区域关联
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..database import Base


class Region(Base):
    """区域表"""
    __tablename__ = "tn_regions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="区域名称")
    code = Column(String(50), nullable=False, comment="区域编码")
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=False, comment="所属租户")
    parent_id = Column(Integer, ForeignKey("tn_regions.id"), nullable=True, comment="父区域ID")
    sort_order = Column(Integer, default=0, comment="排序")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联
    parent = relationship("Region", remote_side=[id], backref="children")
    tenant = relationship("Tenant", backref="regions")


class UserRegion(Base):
    """用户-区域关联表"""
    __tablename__ = "tn_user_regions"
    __table_args__ = (
        UniqueConstraint("user_id", "region_id", name="uq_user_region"),
    )

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("tn_users.id"), nullable=False, comment="用户ID")
    region_id = Column(Integer, ForeignKey("tn_regions.id"), nullable=False, comment="区域ID")

    # 关联
    user = relationship("User", backref="user_regions")
    region = relationship("Region", backref="user_regions")
