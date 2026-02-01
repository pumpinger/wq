"""
拜访任务类型路由
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional

from ..database import get_db
from ..models.visit_task_type import VisitTaskType, VisitTaskTypeField
from ..models.user import User
from ..schemas.visit_task_type import (
    TaskTypeCreate, TaskTypeUpdate, TaskTypeResponse, TaskTypeDetail,
    TaskTypeFieldCreate, TaskTypeFieldUpdate, TaskTypeFieldResponse
)
from ..core.deps import get_current_active_user, require_tenant_admin, get_effective_tenant_id, require_tenant_context

router = APIRouter(prefix="/visit-task-types", tags=["任务类型配置"])


def get_task_type_query(db: Session, current_user: User, tenant_id: Optional[int] = None):
    """根据权限构建任务类型查询 — 系统预设 + 租户自定义"""
    query = db.query(VisitTaskType)
    effective_tenant_id = tenant_id if current_user.is_super_admin else current_user.tenant_id

    if current_user.is_super_admin and effective_tenant_id is None:
        return query

    if effective_tenant_id:
        query = query.filter(
            or_(
                VisitTaskType.tenant_id == None,
                VisitTaskType.tenant_id == effective_tenant_id
            )
        )
    else:
        query = query.filter(VisitTaskType.tenant_id == None)

    return query


@router.get("/", response_model=List[TaskTypeResponse])
def list_task_types(
    request: Request,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取任务类型列表"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_task_type_query(db, current_user, tenant_id)
    if active_only:
        query = query.filter(VisitTaskType.is_active == True)
    return query.order_by(VisitTaskType.sort_order, VisitTaskType.id).all()


@router.post("/", response_model=TaskTypeDetail)
def create_task_type(
    request: Request,
    data: TaskTypeCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """创建任务类型"""
    tenant_id = require_tenant_context(request, current_user)

    task_type = VisitTaskType(
        tenant_id=tenant_id,
        name=data.name,
        code=data.code,
        description=data.description,
        icon=data.icon,
        color=data.color,
        is_system=False,
        is_active=data.is_active,
        sort_order=data.sort_order,
    )
    db.add(task_type)
    db.flush()

    for f in data.fields:
        field = VisitTaskTypeField(
            task_type_id=task_type.id,
            name=f.name,
            field_key=f.field_key,
            field_type=f.field_type,
            options=f.options,
            is_required=f.is_required,
            sort_order=f.sort_order,
        )
        db.add(field)

    db.commit()
    db.refresh(task_type)
    return db.query(VisitTaskType).options(
        joinedload(VisitTaskType.fields)
    ).filter(VisitTaskType.id == task_type.id).first()


@router.get("/{type_id}", response_model=TaskTypeDetail)
def get_task_type(
    type_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取任务类型详情"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_task_type_query(db, current_user, tenant_id)
    task_type = query.options(
        joinedload(VisitTaskType.fields)
    ).filter(VisitTaskType.id == type_id).first()

    if not task_type:
        raise HTTPException(status_code=404, detail="任务类型不存在")
    return task_type


@router.put("/{type_id}", response_model=TaskTypeDetail)
def update_task_type(
    type_id: int,
    request: Request,
    data: TaskTypeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """更新任务类型"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_task_type_query(db, current_user, tenant_id)
    task_type = query.filter(VisitTaskType.id == type_id).first()

    if not task_type:
        raise HTTPException(status_code=404, detail="任务类型不存在")
    if task_type.is_system and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="不能修改系统预设类型")

    for field in ["name", "code", "description", "icon", "color", "is_active", "sort_order"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(task_type, field, val)

    if data.fields is not None:
        db.query(VisitTaskTypeField).filter(VisitTaskTypeField.task_type_id == type_id).delete()
        for f in data.fields:
            field = VisitTaskTypeField(
                task_type_id=type_id,
                name=f.name,
                field_key=f.field_key,
                field_type=f.field_type,
                options=f.options,
                is_required=f.is_required,
                sort_order=f.sort_order,
            )
            db.add(field)

    db.commit()
    return db.query(VisitTaskType).options(
        joinedload(VisitTaskType.fields)
    ).filter(VisitTaskType.id == type_id).first()


@router.delete("/{type_id}")
def delete_task_type(
    type_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """删除任务类型"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_task_type_query(db, current_user, tenant_id)
    task_type = query.filter(VisitTaskType.id == type_id).first()

    if not task_type:
        raise HTTPException(status_code=404, detail="任务类型不存在")
    if task_type.is_system and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="不能删除系统预设类型")

    db.delete(task_type)
    db.commit()
    return {"message": "删除成功"}
