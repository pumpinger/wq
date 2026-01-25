"""
角色和权限模型 (RBAC v2)
支持每个权限独立的数据范围设置
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum, Table
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from ..database import Base

# 用户-角色关联表
user_roles = Table(
    "tn_user_roles",
    Base.metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("user_id", Integer, ForeignKey("tn_users.id", ondelete="CASCADE")),
    Column("role_id", Integer, ForeignKey("tn_roles.id", ondelete="CASCADE")),
    extend_existing=True
)


class RolePermission(Base):
    """角色权限关联表 - 每个权限可以有独立的数据范围"""
    __tablename__ = "tn_role_permissions"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    role_id = Column(Integer, ForeignKey("tn_roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(Integer, ForeignKey("tn_permissions.id", ondelete="CASCADE"), nullable=False)
    data_scope = Column(
        Enum("self", "team", "all", name="role_perm_data_scope"),
        default="self",
        comment="此权限的数据范围"
    )

    # 关联
    permission = relationship("Permission", backref="role_permissions")


class Role(Base):
    """角色表"""
    __tablename__ = "tn_roles"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(Integer, ForeignKey("tn_tenants.id", ondelete="CASCADE"), nullable=True, comment="所属租户")
    name = Column(String(50), nullable=False, comment="角色名称")
    code = Column(String(50), nullable=False, comment="角色编码")
    description = Column(String(200), nullable=True, comment="描述")
    is_system = Column(Boolean, default=False, comment="是否系统预置")
    # 保留 data_scope 作为默认值，新权限会使用这个默认范围
    data_scope = Column(
        Enum("self", "team", "all", name="role_data_scope"),
        default="self",
        comment="默认数据范围"
    )
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # 关联 - 使用新的关联模型
    role_permissions = relationship("RolePermission", backref="role", cascade="all, delete-orphan")
    tenant = relationship("Tenant", backref="roles")


class Permission(Base):
    """权限表"""
    __tablename__ = "tn_permissions"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    module = Column(String(50), nullable=False, comment="模块")
    action = Column(String(50), nullable=False, comment="操作")
    name = Column(String(100), nullable=False, comment="权限名称")
    description = Column(String(200), nullable=True, comment="权限描述")

    @property
    def code(self):
        """权限编码 module:action"""
        return f"{self.module}:{self.action}"


class UserRole(Base):
    """用户角色关联表 (用于显式查询)"""
    __tablename__ = "tn_user_roles"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("tn_users.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("tn_roles.id", ondelete="CASCADE"), nullable=False)
