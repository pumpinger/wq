"""
租户模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Enum, Date, Boolean
from sqlalchemy.sql import func

from ..database import Base


class Tenant(Base):
    __tablename__ = "tn_tenants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False, comment="租户名称")
    code = Column(String(50), nullable=False, unique=True, comment="租户编码")
    status = Column(
        Enum("active", "inactive", "suspended", name="tenant_status"),
        default="active",
        comment="状态"
    )
    max_users = Column(Integer, default=10, comment="最大用户数")
    expires_at = Column(Date, nullable=True, comment="到期时间")
    contact_name = Column(String(50), nullable=True, comment="联系人")
    contact_phone = Column(String(20), nullable=True, comment="联系电话")
    enable_region_scope = Column(Boolean, default=False, comment="是否启用区域权限")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
