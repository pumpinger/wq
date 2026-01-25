"""
租户管理路由（超级管理员专用）
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models.tenant import Tenant
from ..models.user import User
from ..schemas.tenant import (
    TenantCreate,
    TenantUpdate,
    TenantResponse,
    TenantListResponse
)
from ..core.security import get_password_hash
from ..core.deps import require_super_admin

router = APIRouter(prefix="/tenants", tags=["租户管理"])


@router.get("", response_model=TenantListResponse)
def list_tenants(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin)
):
    """获取租户列表"""
    query = db.query(Tenant)

    # 搜索
    if keyword:
        query = query.filter(
            (Tenant.name.contains(keyword)) |
            (Tenant.code.contains(keyword))
        )

    # 状态筛选
    if status:
        query = query.filter(Tenant.status == status)

    # 总数
    total = query.count()

    # 分页
    tenants = query.order_by(Tenant.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    # 计算每个租户的用户数
    items = []
    for tenant in tenants:
        user_count = db.query(func.count(User.id)).filter(
            User.tenant_id == tenant.id
        ).scalar()
        item = TenantResponse(
            id=tenant.id,
            name=tenant.name,
            code=tenant.code,
            status=tenant.status,
            max_users=tenant.max_users,
            expires_at=tenant.expires_at,
            contact_name=tenant.contact_name,
            contact_phone=tenant.contact_phone,
            created_at=tenant.created_at,
            updated_at=tenant.updated_at,
            user_count=user_count
        )
        items.append(item)

    return TenantListResponse(items=items, total=total)


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin)
):
    """获取租户详情"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="租户不存在")

    user_count = db.query(func.count(User.id)).filter(
        User.tenant_id == tenant.id
    ).scalar()

    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        code=tenant.code,
        status=tenant.status,
        max_users=tenant.max_users,
        expires_at=tenant.expires_at,
        contact_name=tenant.contact_name,
        contact_phone=tenant.contact_phone,
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        user_count=user_count
    )


@router.post("", response_model=TenantResponse)
def create_tenant(
    data: TenantCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin)
):
    """创建租户（同时创建管理员账号）"""
    # 检查租户编码是否已存在
    existing = db.query(Tenant).filter(Tenant.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="租户编码已存在")

    # 检查管理员用户名是否已存在
    existing_user = db.query(User).filter(User.username == data.admin_username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="管理员用户名已存在")

    # 创建租户
    tenant = Tenant(
        name=data.name,
        code=data.code,
        max_users=data.max_users,
        expires_at=data.expires_at,
        contact_name=data.contact_name,
        contact_phone=data.contact_phone
    )
    db.add(tenant)
    db.flush()  # 获取 tenant.id

    # 创建租户管理员
    admin = User(
        username=data.admin_username,
        password=get_password_hash(data.admin_password),
        real_name=data.admin_real_name or data.admin_username,
        role="tenant_admin",
        tenant_id=tenant.id,
        status="active"
    )
    db.add(admin)
    db.commit()
    db.refresh(tenant)

    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        code=tenant.code,
        status=tenant.status,
        max_users=tenant.max_users,
        expires_at=tenant.expires_at,
        contact_name=tenant.contact_name,
        contact_phone=tenant.contact_phone,
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        user_count=1
    )


@router.put("/{tenant_id}", response_model=TenantResponse)
def update_tenant(
    tenant_id: int,
    data: TenantUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin)
):
    """更新租户"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="租户不存在")

    # 更新字段
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tenant, key, value)

    db.commit()
    db.refresh(tenant)

    user_count = db.query(func.count(User.id)).filter(
        User.tenant_id == tenant.id
    ).scalar()

    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        code=tenant.code,
        status=tenant.status,
        max_users=tenant.max_users,
        expires_at=tenant.expires_at,
        contact_name=tenant.contact_name,
        contact_phone=tenant.contact_phone,
        created_at=tenant.created_at,
        updated_at=tenant.updated_at,
        user_count=user_count
    )


@router.delete("/{tenant_id}")
def delete_tenant(
    tenant_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_super_admin)
):
    """删除租户（危险操作，会删除所有关联数据）"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="租户不存在")

    # 先删除租户下的所有用户
    db.query(User).filter(User.tenant_id == tenant_id).delete()

    # 删除租户
    db.delete(tenant)
    db.commit()

    return {"message": "租户删除成功"}
