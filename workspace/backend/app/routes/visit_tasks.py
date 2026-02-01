"""
拜访任务路由
"""
import math
from datetime import datetime, date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from ..database import get_db
from ..models.visit_task import VisitTask
from ..models.visit_record import VisitRecord, VisitRecordField, VisitPhoto
from ..models.visit_task_type import VisitTaskType
from ..models.customer import Customer
from ..models.user import User
from ..schemas.visit_task import (
    VisitTaskCreate, VisitTaskUpdate, VisitTaskResponse,
    CheckInRequest, CheckOutRequest, TaskCompleteRequest
)
from ..core.deps import get_current_active_user, require_tenant_admin, get_effective_tenant_id, require_tenant_context

router = APIRouter(prefix="/visit-tasks", tags=["拜访任务"])


def _task_to_response(task: VisitTask) -> dict:
    """转换任务为响应格式"""
    return {
        **{c.name: getattr(task, c.name) for c in task.__table__.columns},
        "customer_name": task.customer.name if task.customer else None,
        "customer_address": task.customer.address if task.customer else None,
        "customer_lat": task.customer.latitude if task.customer else None,
        "customer_lng": task.customer.longitude if task.customer else None,
        "task_type_name": task.task_type.name if task.task_type else None,
        "task_type_color": task.task_type.color if task.task_type else None,
        "task_type_icon": task.task_type.icon if task.task_type else None,
        "assignee_name": task.assignee.real_name if task.assignee else None,
    }


def _haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> int:
    """计算两点间的距离（米）"""
    R = 6371000  # 地球半径（米）
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return int(R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))


@router.get("/", response_model=List[VisitTaskResponse])
def list_tasks(
    request: Request,
    planned_date: Optional[date] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    assigned_to: Optional[int] = None,
    customer_id: Optional[int] = None,
    task_type_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取任务列表"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = db.query(VisitTask).options(
        joinedload(VisitTask.customer),
        joinedload(VisitTask.task_type),
        joinedload(VisitTask.assignee),
    )

    if tenant_id:
        query = query.filter(VisitTask.tenant_id == tenant_id)
    if planned_date:
        query = query.filter(VisitTask.planned_date == planned_date)
    if date_from:
        query = query.filter(VisitTask.planned_date >= date_from)
    if date_to:
        query = query.filter(VisitTask.planned_date <= date_to)
    if assigned_to:
        query = query.filter(VisitTask.assigned_to == assigned_to)
    if customer_id:
        query = query.filter(VisitTask.customer_id == customer_id)
    if task_type_id:
        query = query.filter(VisitTask.task_type_id == task_type_id)
    if status:
        query = query.filter(VisitTask.status == status)

    tasks = query.order_by(VisitTask.planned_date.desc(), VisitTask.sort_order).offset(skip).limit(limit).all()
    return [_task_to_response(t) for t in tasks]


@router.get("/my/today", response_model=List[VisitTaskResponse])
def my_today_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取我的今日任务（H5主入口）"""
    today = date.today()
    tasks = db.query(VisitTask).options(
        joinedload(VisitTask.customer),
        joinedload(VisitTask.task_type),
        joinedload(VisitTask.assignee),
    ).filter(
        VisitTask.assigned_to == current_user.id,
        VisitTask.planned_date == today,
        VisitTask.status.notin_(["cancelled"]),
    ).order_by(VisitTask.sort_order, VisitTask.id).all()
    return [_task_to_response(t) for t in tasks]


@router.get("/my/list", response_model=List[VisitTaskResponse])
def my_tasks(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取我的任务列表（H5）"""
    query = db.query(VisitTask).options(
        joinedload(VisitTask.customer),
        joinedload(VisitTask.task_type),
        joinedload(VisitTask.assignee),
    ).filter(VisitTask.assigned_to == current_user.id)

    if date_from:
        query = query.filter(VisitTask.planned_date >= date_from)
    if date_to:
        query = query.filter(VisitTask.planned_date <= date_to)
    if status:
        query = query.filter(VisitTask.status == status)

    tasks = query.order_by(VisitTask.planned_date.desc(), VisitTask.sort_order).offset(skip).limit(limit).all()
    return [_task_to_response(t) for t in tasks]


@router.post("/", response_model=VisitTaskResponse)
def create_task(
    request: Request,
    data: VisitTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """创建单个任务（临时任务）"""
    tenant_id = require_tenant_context(request, current_user)

    task = VisitTask(
        tenant_id=tenant_id,
        customer_id=data.customer_id,
        task_type_id=data.task_type_id,
        assigned_to=data.assigned_to,
        planned_date=data.planned_date,
        priority=data.priority,
        due_time=data.due_time,
        remark=data.remark,
        created_by=current_user.id,
    )
    db.add(task)
    db.commit()

    task = db.query(VisitTask).options(
        joinedload(VisitTask.customer),
        joinedload(VisitTask.task_type),
        joinedload(VisitTask.assignee),
    ).filter(VisitTask.id == task.id).first()
    return _task_to_response(task)


@router.get("/{task_id}", response_model=VisitTaskResponse)
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取任务详情"""
    task = db.query(VisitTask).options(
        joinedload(VisitTask.customer),
        joinedload(VisitTask.task_type),
        joinedload(VisitTask.assignee),
    ).filter(VisitTask.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return _task_to_response(task)


@router.post("/{task_id}/check-in")
def check_in(
    task_id: int,
    data: CheckInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """签到"""
    task = db.query(VisitTask).options(
        joinedload(VisitTask.customer)
    ).filter(VisitTask.id == task_id).first()

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="不是你的任务")
    if task.status != "pending":
        raise HTTPException(status_code=400, detail="任务状态不允许签到")

    # 计算距离
    distance = None
    if task.customer and task.customer.latitude and task.customer.longitude:
        distance = _haversine_distance(
            float(data.lat), float(data.lng),
            float(task.customer.latitude), float(task.customer.longitude)
        )

    # 创建拜访记录
    record = VisitRecord(
        tenant_id=task.tenant_id,
        task_id=task.id,
        customer_id=task.customer_id,
        user_id=current_user.id,
        task_type_id=task.task_type_id,
        check_in_time=datetime.now(),
        check_in_lat=data.lat,
        check_in_lng=data.lng,
        check_in_address=data.address,
        check_in_distance=distance,
        status="in_progress",
    )
    db.add(record)

    task.status = "checked_in"
    db.commit()
    db.refresh(record)

    return {
        "message": "签到成功",
        "record_id": record.id,
        "distance": distance,
    }


@router.post("/{task_id}/complete")
def complete_task(
    task_id: int,
    data: TaskCompleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """提交表单并完成任务"""
    task = db.query(VisitTask).filter(VisitTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.assigned_to != current_user.id:
        raise HTTPException(status_code=403, detail="不是你的任务")
    if task.status != "checked_in":
        raise HTTPException(status_code=400, detail="请先签到")

    # 找到关联的拜访记录
    record = db.query(VisitRecord).filter(
        VisitRecord.task_id == task_id,
        VisitRecord.status == "in_progress"
    ).first()

    if not record:
        raise HTTPException(status_code=400, detail="未找到拜访记录")

    # 保存表单值
    for fv in data.field_values:
        rf = VisitRecordField(
            record_id=record.id,
            field_key=fv.field_key,
            value=fv.value,
        )
        db.add(rf)

    # 保存照片引用
    for i, photo_path in enumerate(data.photos):
        photo = VisitPhoto(
            record_id=record.id,
            file_path=photo_path,
            sort_order=i,
        )
        db.add(photo)

    # 签退
    now = datetime.now()
    record.check_out_time = now
    if data.check_out_lat:
        record.check_out_lat = data.check_out_lat
    if data.check_out_lng:
        record.check_out_lng = data.check_out_lng
    record.duration_minutes = int((now - record.check_in_time).total_seconds() / 60)
    record.remark = data.remark
    record.status = "completed"

    task.status = "completed"
    db.commit()

    return {"message": "提交成功", "record_id": record.id}


@router.post("/{task_id}/cancel")
def cancel_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """取消任务"""
    task = db.query(VisitTask).filter(VisitTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    if task.status in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="任务已完成或已取消")

    task.status = "cancelled"
    db.commit()
    return {"message": "取消成功"}
