"""
客户公海路由
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import desc
from typing import List, Optional

from ..database import get_db
from ..models import Customer, CustomerPoolRecord, CustomerTemplate
from ..models.user import User
from ..models.tenant import Tenant
from ..models.region import UserRegion
from ..schemas import (
    ReleaseCustomerRequest, ClaimCustomerRequest,
    PoolCustomerResponse, CustomerPoolRecordResponse
)
from ..core.deps import get_current_active_user, get_effective_tenant_id, require_tenant_context

router = APIRouter(prefix="/customers/pool", tags=["客户公海"])


@router.get("/", response_model=List[PoolCustomerResponse])
def list_pool_customers(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    template_id: Optional[int] = None,
    keyword: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取公海客户列表 - 所有租户内员工可见"""
    tenant_id = get_effective_tenant_id(request, current_user)

    if not tenant_id and not current_user.is_super_admin:
        raise HTTPException(status_code=400, detail="未选择租户")

    # 查询公海客户（managed_by 为空）
    query = db.query(Customer).filter(Customer.managed_by.is_(None))

    if tenant_id:
        query = query.filter(Customer.tenant_id == tenant_id)

    if template_id:
        query = query.filter(Customer.template_id == template_id)

    if keyword:
        query = query.filter(Customer.name.contains(keyword))

    # 区域权限过滤
    if tenant_id and not (current_user.is_super_admin or current_user.role == 'tenant_admin'):
        tenant_obj = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant_obj and tenant_obj.enable_region_scope:
            user_region_ids = [ur.region_id for ur in db.query(UserRegion).filter(UserRegion.user_id == current_user.id).all()]
            if user_region_ids:
                query = query.filter(Customer.region_id.in_(user_region_ids))
            else:
                query = query.filter(Customer.region_id.is_(None))

    customers = query.order_by(desc(Customer.updated_at)).offset(skip).limit(limit).all()

    # 获取每个客户的最近一条公海记录
    result = []
    for customer in customers:
        # 查询最近一条进入公海的记录
        pool_record = db.query(CustomerPoolRecord).filter(
            CustomerPoolRecord.customer_id == customer.id,
            CustomerPoolRecord.action.in_(['release', 'auto_reclaim'])
        ).order_by(desc(CustomerPoolRecord.created_at)).first()

        # 获取模板名称
        template_name = None
        if customer.template_id:
            template = db.query(CustomerTemplate).filter(
                CustomerTemplate.id == customer.template_id
            ).first()
            if template:
                template_name = template.name

        result.append(PoolCustomerResponse(
            id=customer.id,
            name=customer.name,
            address=customer.address,
            template_id=customer.template_id,
            template_name=template_name,
            pool_time=pool_record.created_at if pool_record else customer.updated_at,
            pool_reason=pool_record.reason if pool_record else None,
            created_at=customer.created_at
        ))

    return result


@router.post("/{customer_id}/claim")
def claim_customer(
    customer_id: int,
    request: Request,
    data: ClaimCustomerRequest = ClaimCustomerRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """认领公海客户"""
    tenant_id = require_tenant_context(request, current_user)

    # 查询客户
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.tenant_id == tenant_id
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    if customer.managed_by is not None:
        raise HTTPException(status_code=400, detail="该客户已有负责人，无法认领")

    # 认领客户
    customer.managed_by = current_user.id

    # 记录公海历史
    record = CustomerPoolRecord(
        customer_id=customer.id,
        tenant_id=tenant_id,
        action="claim",
        from_user_id=None,
        to_user_id=current_user.id,
        reason=None
    )
    db.add(record)

    db.commit()

    return {"message": "认领成功", "customer_id": customer.id}


@router.post("/{customer_id}/release")
def release_customer(
    customer_id: int,
    request: Request,
    data: ReleaseCustomerRequest = ReleaseCustomerRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """释放客户到公海"""
    tenant_id = require_tenant_context(request, current_user)

    # 查询客户
    customer = db.query(Customer).filter(
        Customer.id == customer_id,
        Customer.tenant_id == tenant_id
    ).first()

    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    if customer.managed_by is None:
        raise HTTPException(status_code=400, detail="该客户已在公海中")

    # 权限检查：只有负责人本人或管理员可以释放
    if customer.managed_by != current_user.id:
        if not (current_user.is_super_admin or current_user.role == 'tenant_admin'):
            raise HTTPException(status_code=403, detail="无权释放他人的客户")

    original_owner = customer.managed_by

    # 释放客户
    customer.managed_by = None

    # 记录公海历史
    record = CustomerPoolRecord(
        customer_id=customer.id,
        tenant_id=tenant_id,
        action="release",
        from_user_id=original_owner,
        to_user_id=None,
        reason=data.reason
    )
    db.add(record)

    db.commit()

    return {"message": "释放成功", "customer_id": customer.id}


@router.get("/{customer_id}/history", response_model=List[CustomerPoolRecordResponse])
def get_customer_pool_history(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取客户公海历史记录"""
    tenant_id = get_effective_tenant_id(request, current_user)

    # 验证客户存在
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在")

    # 租户隔离
    if tenant_id and customer.tenant_id != tenant_id:
        raise HTTPException(status_code=404, detail="客户不存在")

    # 查询公海历史
    records = db.query(CustomerPoolRecord).filter(
        CustomerPoolRecord.customer_id == customer_id
    ).order_by(desc(CustomerPoolRecord.created_at)).all()

    # 获取用户名称映射
    user_ids = set()
    for r in records:
        if r.from_user_id:
            user_ids.add(r.from_user_id)
        if r.to_user_id:
            user_ids.add(r.to_user_id)

    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {u.id: u.real_name or u.username for u in users}

    # 构建响应
    result = []
    for record in records:
        result.append(CustomerPoolRecordResponse(
            id=record.id,
            customer_id=record.customer_id,
            action=record.action,
            from_user_id=record.from_user_id,
            to_user_id=record.to_user_id,
            from_user_name=user_map.get(record.from_user_id) if record.from_user_id else None,
            to_user_name=user_map.get(record.to_user_id) if record.to_user_id else None,
            reason=record.reason,
            created_at=record.created_at
        ))

    return result
