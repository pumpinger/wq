"""
角色权限相关 Schema
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel


class PermissionBase(BaseModel):
    """权限基础信息"""
    code: str
    name: str
    module: Optional[str] = None


class PermissionResponse(PermissionBase):
    """权限响应"""
    id: int

    class Config:
        from_attributes = True


class RoleBase(BaseModel):
    """角色基础信息"""
    name: str
    code: str
    description: Optional[str] = None


class RoleCreate(RoleBase):
    """创建角色"""
    permission_ids: list[int] = []


class RoleUpdate(BaseModel):
    """更新角色"""
    name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[list[int]] = None


class RoleResponse(RoleBase):
    """角色响应"""
    id: int
    tenant_id: Optional[int] = None
    permissions: list[PermissionResponse] = []
    created_at: datetime

    class Config:
        from_attributes = True


class RoleListResponse(BaseModel):
    """角色列表响应"""
    items: list[RoleResponse]
    total: int
