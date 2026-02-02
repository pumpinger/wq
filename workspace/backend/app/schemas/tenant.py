"""
租户相关 Schema
"""
from typing import Optional
from datetime import date, datetime
from pydantic import BaseModel


class TenantBase(BaseModel):
    """租户基础信息"""
    name: str
    code: str
    max_users: int = 10
    expires_at: Optional[date] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None


class TenantCreate(TenantBase):
    """创建租户"""
    admin_username: str  # 管理员用户名
    admin_password: str  # 管理员密码
    admin_real_name: Optional[str] = None


class TenantUpdate(BaseModel):
    """更新租户"""
    name: Optional[str] = None
    max_users: Optional[int] = None
    expires_at: Optional[date] = None
    status: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    enable_region_scope: Optional[bool] = None
    enable_customer: Optional[bool] = None
    enable_attendance: Optional[bool] = None
    enable_visit: Optional[bool] = None


class TenantResponse(TenantBase):
    """租户响应"""
    id: int
    status: str
    enable_region_scope: bool = False
    enable_customer: bool = True
    enable_attendance: bool = False
    enable_visit: bool = True
    created_at: datetime
    updated_at: datetime
    user_count: int = 0

    class Config:
        from_attributes = True


class TenantListResponse(BaseModel):
    """租户列表响应"""
    items: list[TenantResponse]
    total: int
