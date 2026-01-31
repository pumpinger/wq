"""
区域管理路由
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models.region import Region, UserRegion
from ..models.user import User
from ..models.customer import Customer
from ..schemas.region import RegionCreate, RegionUpdate, RegionResponse, RegionListResponse
from ..core.deps import get_current_active_user, require_tenant_admin, get_effective_tenant_id, require_tenant_context

router = APIRouter(prefix="/regions", tags=["区域管理"])


@router.get("", response_model=RegionListResponse)
def list_regions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取区域列表"""
    tenant_id = get_effective_tenant_id(request, current_user)
    if not tenant_id and not current_user.is_super_admin:
        raise HTTPException(status_code=400, detail="未选择租户")

    query = db.query(Region)
    if tenant_id:
        query = query.filter(Region.tenant_id == tenant_id)

    total = query.count()
    items = query.order_by(Region.sort_order, Region.id).all()

    return RegionListResponse(
        items=[RegionResponse.model_validate(r) for r in items],
        total=total
    )


@router.post("", response_model=RegionResponse)
def create_region(
    request: Request,
    data: RegionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """创建区域"""
    tenant_id = require_tenant_context(request, current_user)

    # 检查编码唯一性（同租户内）
    existing = db.query(Region).filter(
        Region.tenant_id == tenant_id,
        Region.code == data.code
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="区域编码已存在")

    # 验证父区域
    if data.parent_id:
        parent = db.query(Region).filter(
            Region.id == data.parent_id,
            Region.tenant_id == tenant_id
        ).first()
        if not parent:
            raise HTTPException(status_code=400, detail="父区域不存在")

    region = Region(
        name=data.name,
        code=data.code,
        tenant_id=tenant_id,
        parent_id=data.parent_id,
        sort_order=data.sort_order
    )
    db.add(region)
    db.commit()
    db.refresh(region)

    return RegionResponse.model_validate(region)


@router.put("/{region_id}", response_model=RegionResponse)
def update_region(
    region_id: int,
    request: Request,
    data: RegionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """更新区域"""
    tenant_id = get_effective_tenant_id(request, current_user)

    region = db.query(Region).filter(Region.id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="区域不存在")
    if tenant_id and region.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="无权限修改该区域")

    # 检查编码唯一性
    if data.code is not None and data.code != region.code:
        existing = db.query(Region).filter(
            Region.tenant_id == region.tenant_id,
            Region.code == data.code,
            Region.id != region_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="区域编码已存在")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(region, key, value)

    db.commit()
    db.refresh(region)

    return RegionResponse.model_validate(region)


@router.delete("/{region_id}")
def delete_region(
    region_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """删除区域"""
    tenant_id = get_effective_tenant_id(request, current_user)

    region = db.query(Region).filter(Region.id == region_id).first()
    if not region:
        raise HTTPException(status_code=404, detail="区域不存在")
    if tenant_id and region.tenant_id != tenant_id:
        raise HTTPException(status_code=403, detail="无权限删除该区域")

    # 检查是否有子区域
    children = db.query(Region).filter(Region.parent_id == region_id).count()
    if children > 0:
        raise HTTPException(status_code=400, detail="请先删除子区域")

    # 将引用该区域的客户的 region_id 置空
    db.query(Customer).filter(Customer.region_id == region_id).update(
        {Customer.region_id: None}, synchronize_session=False
    )
    # 删除用户-区域关联
    db.query(UserRegion).filter(UserRegion.region_id == region_id).delete(synchronize_session=False)

    db.delete(region)
    db.commit()

    return {"message": "区域删除成功"}
