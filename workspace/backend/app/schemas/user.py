"""
用户相关 Schema
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    """用户基础信息"""
    username: str
    real_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: str = "user"
    department_id: Optional[int] = None
    manager_id: Optional[int] = None
    data_scope: Optional[str] = "self"


class UserCreate(UserBase):
    """创建用户"""
    password: str


class UserUpdate(BaseModel):
    """更新用户"""
    real_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    department_id: Optional[int] = None
    manager_id: Optional[int] = None
    data_scope: Optional[str] = None
    password: Optional[str] = None  # 可选重置密码


class UserResponse(UserBase):
    """用户响应"""
    id: int
    status: str
    is_super_admin: bool
    tenant_id: Optional[int] = None
    manager_id: Optional[int] = None
    data_scope: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    """用户列表响应"""
    items: list[UserResponse]
    total: int
