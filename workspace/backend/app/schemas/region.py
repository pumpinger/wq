"""
区域相关 Schema
"""
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class RegionCreate(BaseModel):
    """创建区域"""
    name: str
    code: str
    parent_id: Optional[int] = None
    sort_order: int = 0


class RegionUpdate(BaseModel):
    """更新区域"""
    name: Optional[str] = None
    code: Optional[str] = None
    parent_id: Optional[int] = None
    sort_order: Optional[int] = None


class RegionResponse(BaseModel):
    """区域响应"""
    id: int
    name: str
    code: str
    tenant_id: int
    parent_id: Optional[int] = None
    sort_order: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RegionListResponse(BaseModel):
    """区域列表响应"""
    items: List[RegionResponse]
    total: int


class UserRegionAssign(BaseModel):
    """用户区域分配"""
    region_ids: List[int]
