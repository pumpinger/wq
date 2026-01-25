from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


class CustomerPoolRecordResponse(BaseModel):
    """公海记录响应"""
    id: int
    customer_id: int
    action: str
    from_user_id: Optional[int] = None
    to_user_id: Optional[int] = None
    from_user_name: Optional[str] = None
    to_user_name: Optional[str] = None
    reason: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ReleaseCustomerRequest(BaseModel):
    """释放客户到公海请求"""
    reason: Optional[str] = None


class ClaimCustomerRequest(BaseModel):
    """认领公海客户请求"""
    pass


class PoolCustomerResponse(BaseModel):
    """公海客户响应"""
    id: int
    name: str
    address: Optional[str] = None
    template_id: Optional[int] = None
    template_name: Optional[str] = None
    pool_time: Optional[datetime] = None  # 进入公海时间
    pool_reason: Optional[str] = None  # 进入公海原因
    created_at: datetime

    class Config:
        from_attributes = True
