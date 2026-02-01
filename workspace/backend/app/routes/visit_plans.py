"""
拜访计划路由
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date

from ..database import get_db
from ..models.visit_plan import VisitPlan
from ..models.visit_task import VisitTask
from ..models.user import User
from ..schemas.visit_plan import (
    VisitPlanCreate, VisitPlanUpdate, VisitPlanResponse, VisitPlanDetail, VisitTaskBrief
)
from ..core.deps import get_current_active_user, require_tenant_admin, get_effective_tenant_id, require_tenant_context

router = APIRouter(prefix="/visit-plans", tags=["拜访计划"])


def _plan_to_response(plan: VisitPlan) -> dict:
    """转换计划为响应格式"""
    tasks = plan.tasks or []
    return {
        **{c.name: getattr(plan, c.name) for c in plan.__table__.columns},
        "assignee_name": plan.assignee.real_name if plan.assignee else None,
        "task_count": len(tasks),
        "completed_count": sum(1 for t in tasks if t.status == "completed"),
    }


@router.get("/", response_model=List[VisitPlanResponse])
def list_plans(
    request: Request,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    assigned_to: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取拜访计划列表"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = db.query(VisitPlan).options(
        joinedload(VisitPlan.tasks), joinedload(VisitPlan.assignee)
    )

    if tenant_id:
        query = query.filter(VisitPlan.tenant_id == tenant_id)

    if date_from:
        query = query.filter(VisitPlan.plan_date >= date_from)
    if date_to:
        query = query.filter(VisitPlan.plan_date <= date_to)
    if assigned_to:
        query = query.filter(VisitPlan.assigned_to == assigned_to)
    if status:
        query = query.filter(VisitPlan.status == status)

    plans = query.order_by(VisitPlan.plan_date.desc()).offset(skip).limit(limit).all()
    return [_plan_to_response(p) for p in plans]


@router.post("/", response_model=VisitPlanResponse)
def create_plan(
    request: Request,
    data: VisitPlanCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """创建拜访计划"""
    tenant_id = require_tenant_context(request, current_user)

    plan = VisitPlan(
        tenant_id=tenant_id,
        title=data.title,
        plan_date=data.plan_date,
        assigned_to=data.assigned_to,
        created_by=current_user.id,
        remark=data.remark,
        status="draft",
    )
    db.add(plan)
    db.flush()

    for t in data.tasks:
        task = VisitTask(
            tenant_id=tenant_id,
            plan_id=plan.id,
            customer_id=t.customer_id,
            task_type_id=t.task_type_id,
            assigned_to=data.assigned_to,
            planned_date=data.plan_date,
            priority=t.priority,
            remark=t.remark,
            sort_order=t.sort_order,
            created_by=current_user.id,
        )
        db.add(task)

    db.commit()

    plan = db.query(VisitPlan).options(
        joinedload(VisitPlan.tasks), joinedload(VisitPlan.assignee)
    ).filter(VisitPlan.id == plan.id).first()
    return _plan_to_response(plan)


@router.get("/my", response_model=List[VisitPlanResponse])
def my_plans(
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取当前用户的计划（H5）"""
    query = db.query(VisitPlan).options(
        joinedload(VisitPlan.tasks), joinedload(VisitPlan.assignee)
    ).filter(
        VisitPlan.assigned_to == current_user.id,
        VisitPlan.status.in_(["published", "in_progress"])
    )

    if date_from:
        query = query.filter(VisitPlan.plan_date >= date_from)
    if date_to:
        query = query.filter(VisitPlan.plan_date <= date_to)

    plans = query.order_by(VisitPlan.plan_date.desc()).limit(50).all()
    return [_plan_to_response(p) for p in plans]


@router.get("/{plan_id}", response_model=VisitPlanDetail)
def get_plan(
    plan_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取计划详情"""
    plan = db.query(VisitPlan).options(
        joinedload(VisitPlan.tasks).joinedload(VisitTask.customer),
        joinedload(VisitPlan.tasks).joinedload(VisitTask.task_type),
        joinedload(VisitPlan.assignee),
    ).filter(VisitPlan.id == plan_id).first()

    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")

    resp = _plan_to_response(plan)
    resp["tasks"] = [
        VisitTaskBrief(
            id=t.id,
            customer_id=t.customer_id,
            customer_name=t.customer.name if t.customer else None,
            task_type_id=t.task_type_id,
            task_type_name=t.task_type.name if t.task_type else None,
            status=t.status,
            priority=t.priority,
            sort_order=t.sort_order,
        )
        for t in plan.tasks
    ]
    return resp


@router.put("/{plan_id}", response_model=VisitPlanResponse)
def update_plan(
    plan_id: int,
    request: Request,
    data: VisitPlanUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """更新计划"""
    plan = db.query(VisitPlan).filter(VisitPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    if plan.status not in ["draft"]:
        raise HTTPException(status_code=400, detail="只能修改草稿状态的计划")

    tenant_id = require_tenant_context(request, current_user)

    for field in ["title", "plan_date", "assigned_to", "remark"]:
        val = getattr(data, field, None)
        if val is not None:
            setattr(plan, field, val)

    if data.tasks is not None:
        # 删旧任务，加新任务
        db.query(VisitTask).filter(VisitTask.plan_id == plan_id).delete()
        effective_date = data.plan_date or plan.plan_date
        effective_assignee = data.assigned_to or plan.assigned_to
        for t in data.tasks:
            task = VisitTask(
                tenant_id=tenant_id,
                plan_id=plan.id,
                customer_id=t.customer_id,
                task_type_id=t.task_type_id,
                assigned_to=effective_assignee,
                planned_date=effective_date,
                priority=t.priority,
                remark=t.remark,
                sort_order=t.sort_order,
                created_by=current_user.id,
            )
            db.add(task)

    db.commit()
    plan = db.query(VisitPlan).options(
        joinedload(VisitPlan.tasks), joinedload(VisitPlan.assignee)
    ).filter(VisitPlan.id == plan_id).first()
    return _plan_to_response(plan)


@router.post("/{plan_id}/publish")
def publish_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """发布计划"""
    plan = db.query(VisitPlan).filter(VisitPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    if plan.status != "draft":
        raise HTTPException(status_code=400, detail="只能发布草稿计划")

    plan.status = "published"
    db.commit()
    return {"message": "发布成功"}


@router.post("/{plan_id}/cancel")
def cancel_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """取消计划"""
    plan = db.query(VisitPlan).filter(VisitPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    if plan.status in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="计划已完成或已取消")

    plan.status = "cancelled"
    # 取消关联的待执行任务
    db.query(VisitTask).filter(
        VisitTask.plan_id == plan_id,
        VisitTask.status == "pending"
    ).update({"status": "cancelled"})
    db.commit()
    return {"message": "取消成功"}


@router.delete("/{plan_id}")
def delete_plan(
    plan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """删除计划（仅草稿）"""
    plan = db.query(VisitPlan).filter(VisitPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="计划不存在")
    if plan.status != "draft":
        raise HTTPException(status_code=400, detail="只能删除草稿计划")

    db.delete(plan)
    db.commit()
    return {"message": "删除成功"}
