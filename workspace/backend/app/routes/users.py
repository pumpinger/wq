"""
用户管理路由
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..models.user import User
from ..models.tenant import Tenant
from ..models.region import Region, UserRegion
from ..schemas.user import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserListResponse
)
from ..schemas.region import UserRegionAssign
from ..core.security import get_password_hash
from ..core.deps import get_current_active_user, require_tenant_admin, get_effective_tenant_id, require_tenant_context

router = APIRouter(prefix="/users", tags=["用户管理"])


def _build_user_response(user: User, db: Session) -> UserResponse:
    """构建包含 region_ids 的用户响应"""
    region_ids = [ur.region_id for ur in db.query(UserRegion).filter(UserRegion.user_id == user.id).all()]
    resp = UserResponse.model_validate(user)
    resp.region_ids = region_ids
    return resp


@router.get("", response_model=UserListResponse)
def list_users(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    keyword: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """获取用户列表"""
    query = db.query(User)

    # 获取有效租户ID
    tenant_id = get_effective_tenant_id(request, current_user)

    # 按租户过滤（超管选择租户后也按租户过滤）
    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)

    # 排除超级管理员
    query = query.filter(User.is_super_admin == False)

    # 搜索
    if keyword:
        query = query.filter(
            (User.username.contains(keyword)) |
            (User.real_name.contains(keyword)) |
            (User.phone.contains(keyword))
        )

    # 状态筛选
    if status:
        query = query.filter(User.status == status)

    # 总数
    total = query.count()

    # 分页
    users = query.order_by(User.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    items = [_build_user_response(u, db) for u in users]

    return UserListResponse(items=items, total=total)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """获取用户详情"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 权限检查：按有效租户ID过滤
    tenant_id = get_effective_tenant_id(request, current_user)
    if tenant_id and user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="无权限查看该用户")

    return _build_user_response(user, db)


@router.post("", response_model=UserResponse)
def create_user(
    request: Request,
    data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """创建用户"""
    # 检查用户名是否已存在
    existing = db.query(User).filter(User.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已存在")

    # 确定租户ID（超管通过 Header 指定，租户管理员用自己的租户）
    tenant_id = require_tenant_context(request, current_user)

    # 检查用户数量限制
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if tenant:
        current_count = db.query(func.count(User.id)).filter(
            User.tenant_id == tenant_id
        ).scalar()
        if current_count >= tenant.max_users:
            raise HTTPException(status_code=400, detail=f"已达到最大用户数限制({tenant.max_users})")

    # 创建用户
    user = User(
        username=data.username,
        password=get_password_hash(data.password),
        real_name=data.real_name,
        email=data.email,
        phone=data.phone,
        role=data.role,
        department_id=data.department_id,
        manager_id=data.manager_id,
        data_scope=data.data_scope or "self",
        tenant_id=tenant_id,
        status="active"
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return _build_user_response(user, db)


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    request: Request,
    data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """更新用户"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 权限检查：按有效租户ID
    tenant_id = get_effective_tenant_id(request, current_user)
    if tenant_id and user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="无权限修改该用户")

    # 不能修改超级管理员
    if user.is_super_admin:
        raise HTTPException(status_code=403, detail="不能修改超级管理员")

    # 更新字段
    update_data = data.model_dump(exclude_unset=True)

    # 如果更新密码，需要加密
    if "password" in update_data and update_data["password"]:
        update_data["password"] = get_password_hash(update_data["password"])
    elif "password" in update_data:
        del update_data["password"]

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    return _build_user_response(user, db)


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """删除用户"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 权限检查：按有效租户ID
    tenant_id = get_effective_tenant_id(request, current_user)
    if tenant_id and user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="无权限删除该用户")

    # 不能删除超级管理员
    if user.is_super_admin:
        raise HTTPException(status_code=403, detail="不能删除超级管理员")

    # 不能删除自己
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="不能删除自己")

    db.delete(user)
    db.commit()

    return {"message": "用户删除成功"}


@router.get("/{user_id}/regions")
def get_user_regions(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """获取用户的区域列表"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    tenant_id = get_effective_tenant_id(request, current_user)
    if tenant_id and user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="无权限查看该用户")

    user_regions = db.query(UserRegion).filter(UserRegion.user_id == user_id).all()
    region_ids = [ur.region_id for ur in user_regions]

    return {"region_ids": region_ids}


@router.put("/{user_id}/regions")
def assign_user_regions(
    user_id: int,
    request: Request,
    data: UserRegionAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """分配区域给用户"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")

    tenant_id = get_effective_tenant_id(request, current_user)
    if tenant_id and user.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="无权限修改该用户")

    # 验证区域都属于同一租户
    if data.region_ids:
        regions = db.query(Region).filter(
            Region.id.in_(data.region_ids),
            Region.tenant_id == (tenant_id or user.tenant_id)
        ).all()
        if len(regions) != len(data.region_ids):
            raise HTTPException(status_code=400, detail="部分区域不存在或不属于当前租户")

    # 清除旧的关联
    db.query(UserRegion).filter(UserRegion.user_id == user_id).delete()

    # 建立新的关联
    for region_id in data.region_ids:
        db.add(UserRegion(user_id=user_id, region_id=region_id))

    db.commit()

    return {"message": "区域分配成功", "region_ids": data.region_ids}
