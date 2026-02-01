"""
拜访记录路由
"""
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func as sql_func
from typing import List, Optional

from ..database import get_db
from ..models.visit_record import VisitRecord, VisitRecordField, VisitPhoto
from ..models.user import User
from ..schemas.visit_record import (
    VisitRecordResponse, VisitRecordDetail,
    VisitRecordFieldResponse, VisitPhotoResponse,
    VisitStatsSummary, VisitStatsByUser
)
from ..core.deps import get_current_active_user, get_effective_tenant_id

router = APIRouter(prefix="/visit-records", tags=["拜访记录"])


def _record_to_response(record: VisitRecord) -> dict:
    return {
        **{c.name: getattr(record, c.name) for c in record.__table__.columns},
        "customer_name": record.customer.name if record.customer else None,
        "user_name": record.user.real_name if record.user else None,
        "task_type_name": record.task_type.name if record.task_type else None,
    }


@router.get("/", response_model=List[VisitRecordResponse])
def list_records(
    request: Request,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    user_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    task_type_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取拜访记录列表"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = db.query(VisitRecord).options(
        joinedload(VisitRecord.customer),
        joinedload(VisitRecord.user),
        joinedload(VisitRecord.task_type),
    )

    if tenant_id:
        query = query.filter(VisitRecord.tenant_id == tenant_id)
    if date_from:
        query = query.filter(sql_func.date(VisitRecord.check_in_time) >= date_from)
    if date_to:
        query = query.filter(sql_func.date(VisitRecord.check_in_time) <= date_to)
    if user_id:
        query = query.filter(VisitRecord.user_id == user_id)
    if customer_id:
        query = query.filter(VisitRecord.customer_id == customer_id)
    if task_type_id:
        query = query.filter(VisitRecord.task_type_id == task_type_id)
    if status:
        query = query.filter(VisitRecord.status == status)

    records = query.order_by(VisitRecord.check_in_time.desc()).offset(skip).limit(limit).all()
    return [_record_to_response(r) for r in records]


@router.get("/my", response_model=List[VisitRecordResponse])
def my_records(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    skip: int = 0,
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取我的拜访记录（H5）"""
    query = db.query(VisitRecord).options(
        joinedload(VisitRecord.customer),
        joinedload(VisitRecord.user),
        joinedload(VisitRecord.task_type),
    ).filter(VisitRecord.user_id == current_user.id)

    if date_from:
        query = query.filter(sql_func.date(VisitRecord.check_in_time) >= date_from)
    if date_to:
        query = query.filter(sql_func.date(VisitRecord.check_in_time) <= date_to)

    records = query.order_by(VisitRecord.check_in_time.desc()).offset(skip).limit(limit).all()
    return [_record_to_response(r) for r in records]


@router.get("/stats/summary", response_model=VisitStatsSummary)
def stats_summary(
    request: Request,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """拜访统计摘要"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = db.query(VisitRecord)

    if tenant_id:
        query = query.filter(VisitRecord.tenant_id == tenant_id)
    if date_from:
        query = query.filter(sql_func.date(VisitRecord.check_in_time) >= date_from)
    if date_to:
        query = query.filter(sql_func.date(VisitRecord.check_in_time) <= date_to)

    total = query.count()
    completed = query.filter(VisitRecord.status == "completed").count()
    avg_duration = db.query(sql_func.avg(VisitRecord.duration_minutes)).filter(
        VisitRecord.status == "completed",
        VisitRecord.tenant_id == tenant_id if tenant_id else True,
    ).scalar() or 0

    customers_visited = query.with_entities(
        sql_func.count(sql_func.distinct(VisitRecord.customer_id))
    ).scalar() or 0

    return VisitStatsSummary(
        total_visits=total,
        completed_visits=completed,
        completion_rate=round(completed / total * 100, 1) if total > 0 else 0,
        avg_duration_minutes=round(float(avg_duration), 1),
        total_customers_visited=customers_visited,
    )


@router.get("/stats/by-user", response_model=List[VisitStatsByUser])
def stats_by_user(
    request: Request,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """按用户统计"""
    tenant_id = get_effective_tenant_id(request, current_user)

    query = db.query(
        VisitRecord.user_id,
        sql_func.count(VisitRecord.id).label("visit_count"),
        sql_func.sum(sql_func.IF(VisitRecord.status == "completed", 1, 0)).label("completed_count"),
        sql_func.avg(VisitRecord.duration_minutes).label("avg_duration"),
    ).group_by(VisitRecord.user_id)

    if tenant_id:
        query = query.filter(VisitRecord.tenant_id == tenant_id)
    if date_from:
        query = query.filter(sql_func.date(VisitRecord.check_in_time) >= date_from)
    if date_to:
        query = query.filter(sql_func.date(VisitRecord.check_in_time) <= date_to)

    rows = query.all()

    # 获取用户名
    from ..models.user import User as UserModel
    user_ids = [r[0] for r in rows]
    users = {u.id: u.real_name for u in db.query(UserModel).filter(UserModel.id.in_(user_ids)).all()} if user_ids else {}

    return [
        VisitStatsByUser(
            user_id=r[0],
            user_name=users.get(r[0]),
            visit_count=r[1],
            completed_count=int(r[2] or 0),
            avg_duration=round(float(r[3] or 0), 1),
        )
        for r in rows
    ]


@router.get("/{record_id}", response_model=VisitRecordDetail)
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取拜访记录详情"""
    record = db.query(VisitRecord).options(
        joinedload(VisitRecord.customer),
        joinedload(VisitRecord.user),
        joinedload(VisitRecord.task_type),
        joinedload(VisitRecord.field_values),
        joinedload(VisitRecord.photos),
    ).filter(VisitRecord.id == record_id).first()

    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    resp = _record_to_response(record)
    resp["field_values"] = [
        VisitRecordFieldResponse(field_key=fv.field_key, value=fv.value)
        for fv in record.field_values
    ]
    resp["photos"] = [
        VisitPhotoResponse(
            id=p.id, field_key=p.field_key, file_path=p.file_path,
            file_name=p.file_name, thumbnail_path=p.thumbnail_path, sort_order=p.sort_order,
        )
        for p in record.photos
    ]
    return resp
