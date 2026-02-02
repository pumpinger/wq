"""
订阅订单管理路由
"""
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func as sql_func

from ..database import get_db
from ..models.subscription_order import SubscriptionOrder
from ..models.tenant import Tenant
from ..models.user import User
from ..schemas.subscription_order import (
    SubscriptionOrderCreate,
    SubscriptionOrderUpdate,
    SubscriptionOrderResponse,
    SubscriptionOrderListResponse,
)
from ..core.deps import require_super_admin
from ..core.security import get_password_hash

router = APIRouter(prefix="/subscription-orders", tags=["订阅管理"])


def _generate_order_no(db: Session) -> str:
    """生成订单号 SUB-YYYYMMDD-NNNN"""
    today = datetime.now().strftime("%Y%m%d")
    prefix = f"SUB-{today}-"
    last = (
        db.query(SubscriptionOrder)
        .filter(SubscriptionOrder.order_no.like(f"{prefix}%"))
        .order_by(SubscriptionOrder.id.desc())
        .first()
    )
    if last:
        seq = int(last.order_no.split("-")[-1]) + 1
    else:
        seq = 1
    return f"{prefix}{seq:04d}"


def _sync_tenant_status(db: Session, tenant_id: int):
    """根据活跃订阅数同步租户状态：无活跃订阅 -> suspended"""
    if not tenant_id:
        return
    # flush 确保先前的 status 修改已反映到查询中
    db.flush()
    active_count = (
        db.query(SubscriptionOrder)
        .filter(
            SubscriptionOrder.tenant_id == tenant_id,
            SubscriptionOrder.status == "active",
        )
        .count()
    )
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        return
    if active_count == 0:
        tenant.status = "suspended"
    else:
        tenant.status = "active"


@router.get("/", response_model=SubscriptionOrderListResponse)
def list_orders(
    status_filter: str = Query(None, alias="status"),
    tenant_id: int = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    query = db.query(SubscriptionOrder)
    if status_filter:
        query = query.filter(SubscriptionOrder.status == status_filter)
    if tenant_id:
        query = query.filter(SubscriptionOrder.tenant_id == tenant_id)
    total = query.count()
    items = query.order_by(SubscriptionOrder.id.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return SubscriptionOrderListResponse(items=items, total=total)


@router.post("/", response_model=SubscriptionOrderResponse)
def create_order(
    data: SubscriptionOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    order = SubscriptionOrder(
        order_no=_generate_order_no(db),
        tenant_id=data.tenant_id,
        tenant_name=data.tenant_name,
        modules=data.modules,
        max_users=data.max_users,
        amount=data.amount,
        start_date=data.start_date,
        end_date=data.end_date,
        remark=data.remark,
        status="pending",
        created_by=current_user.id,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


@router.put("/{order_id}", response_model=SubscriptionOrderResponse)
def update_order(
    order_id: int,
    data: SubscriptionOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    order = db.query(SubscriptionOrder).filter(SubscriptionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status not in ("pending",):
        raise HTTPException(status_code=400, detail="只有待激活订单可以修改")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(order, field, value)
    db.commit()
    db.refresh(order)
    return order


@router.post("/{order_id}/activate", response_model=SubscriptionOrderResponse)
def activate_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    """激活订阅 - 写入租户模块开关+到期时间+max_users"""
    order = db.query(SubscriptionOrder).filter(SubscriptionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status != "pending":
        raise HTTPException(status_code=400, detail="只有待激活订单可以激活")

    modules = order.modules or {}

    if order.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == order.tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="关联的租户不存在")
    else:
        raise HTTPException(
            status_code=400,
            detail="该订单未关联租户，请先编辑订单选择租户",
        )

    # 更新租户模块开关
    tenant.enable_customer = modules.get("customer", True)
    tenant.enable_attendance = modules.get("attendance", False)
    tenant.enable_visit = modules.get("visit", True)
    tenant.max_users = order.max_users
    tenant.expires_at = order.end_date
    # 激活订阅时确保租户状态为 active
    tenant.status = "active"

    # 更新订单状态
    order.status = "active"
    order.activated_at = datetime.now()

    db.commit()
    db.refresh(order)
    return order


@router.post("/{order_id}/cancel", response_model=SubscriptionOrderResponse)
def cancel_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    order = db.query(SubscriptionOrder).filter(SubscriptionOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    if order.status not in ("pending", "active"):
        raise HTTPException(status_code=400, detail="该状态不可取消")

    was_active = order.status == "active"
    order.status = "cancelled"

    # 取消活跃订阅后，检查租户是否还有其他活跃订阅
    if was_active and order.tenant_id:
        _sync_tenant_status(db, order.tenant_id)

    db.commit()
    db.refresh(order)
    return order
