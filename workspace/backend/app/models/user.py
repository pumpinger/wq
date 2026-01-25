"""
用户模型
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..database import Base


class User(Base):
    __tablename__ = "tn_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(50), nullable=False, comment="用户名")
    password = Column(String(255), nullable=False, comment="密码")
    real_name = Column(String(50), nullable=True, comment="真实姓名")
    email = Column(String(100), nullable=True, comment="邮箱")
    phone = Column(String(20), nullable=True, comment="手机号")
    role = Column(String(20), nullable=False, default="user", comment="角色")
    status = Column(
        Enum("active", "inactive", name="user_status"),
        default="active",
        comment="状态"
    )
    is_super_admin = Column(Boolean, default=False, comment="是否超级管理员")
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id"), nullable=True, comment="所属租户")
    department_id = Column(Integer, nullable=True, comment="部门ID")
    manager_id = Column(Integer, ForeignKey("tn_users.id"), nullable=True, comment="直属上级ID")
    data_scope = Column(
        Enum("self", "team", "all", name="data_scope_type"),
        default="self",
        comment="数据权限范围: self=仅自己, team=自己+下属, all=全部"
    )
    face_data = Column(String(255), nullable=True, comment="人脸数据")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联
    tenant = relationship("Tenant", backref="users")
    manager = relationship("User", remote_side=[id], backref="subordinates")
    roles = relationship("Role", secondary="tn_user_roles", backref="users")
