from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime


class VisitPlanTaskItem(BaseModel):
    """计划中的任务项"""
    customer_id: int
    task_type_id: int
    priority: str = "normal"
    remark: Optional[str] = None
    sort_order: int = 0


class VisitPlanCreate(BaseModel):
    title: str
    plan_date: date
    assigned_to: int
    remark: Optional[str] = None
    tasks: List[VisitPlanTaskItem] = []


class VisitPlanUpdate(BaseModel):
    title: Optional[str] = None
    plan_date: Optional[date] = None
    assigned_to: Optional[int] = None
    remark: Optional[str] = None
    tasks: Optional[List[VisitPlanTaskItem]] = None


class VisitPlanResponse(BaseModel):
    id: int
    tenant_id: int
    title: str
    plan_date: date
    assigned_to: int
    assignee_name: Optional[str] = None
    created_by: int
    status: str
    remark: Optional[str] = None
    task_count: int = 0
    completed_count: int = 0
    created_at: datetime

    class Config:
        from_attributes = True


class VisitTaskBrief(BaseModel):
    id: int
    customer_id: int
    customer_name: Optional[str] = None
    task_type_id: int
    task_type_name: Optional[str] = None
    status: str
    priority: str
    sort_order: int

    class Config:
        from_attributes = True


class VisitPlanDetail(VisitPlanResponse):
    tasks: List[VisitTaskBrief] = []
