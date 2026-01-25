from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List, Optional

from ..database import get_db
from ..models import FieldDefinition
from ..models.user import User
from ..schemas import FieldDefinitionCreate, FieldDefinitionUpdate, FieldDefinitionResponse
from ..core.deps import get_current_active_user, require_tenant_admin, get_effective_tenant_id, require_tenant_context

router = APIRouter(prefix="/field-definitions", tags=["字段定义"])


def get_field_query(db: Session, current_user: User, tenant_id: Optional[int] = None):
    """根据用户权限构建字段查询 - 系统字段 + 租户自定义字段"""
    from sqlalchemy import or_

    query = db.query(FieldDefinition)

    # 确定有效的租户ID
    effective_tenant_id = tenant_id if current_user.is_super_admin else current_user.tenant_id

    if current_user.is_super_admin and effective_tenant_id is None:
        # 超管未选择租户时，返回所有字段
        return query

    # 租户可见字段 = 系统字段(tenant_id=NULL) + 自定义字段(tenant_id=租户ID)
    if effective_tenant_id:
        query = query.filter(
            or_(
                FieldDefinition.tenant_id == None,  # 系统字段
                FieldDefinition.tenant_id == effective_tenant_id  # 租户自定义字段
            )
        )
    else:
        # 没有租户的用户只能看系统字段
        query = query.filter(FieldDefinition.tenant_id == None)

    return query


@router.get("/", response_model=List[FieldDefinitionResponse])
def list_field_definitions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取所有字段定义"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_field_query(db, current_user, tenant_id)
    return query.all()


@router.post("/", response_model=FieldDefinitionResponse)
def create_field_definition(
    request: Request,
    data: FieldDefinitionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """创建字段定义"""
    tenant_id = require_tenant_context(request, current_user)

    # 检查字段键名是否在本租户内已存在
    existing = get_field_query(db, current_user, tenant_id).filter(
        FieldDefinition.field_key == data.field_key
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="字段键名已存在")

    field = FieldDefinition(
        **data.model_dump(),
        tenant_id=tenant_id
    )
    db.add(field)
    db.commit()
    db.refresh(field)
    return field


@router.get("/{field_id}", response_model=FieldDefinitionResponse)
def get_field_definition(
    field_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取字段定义详情"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_field_query(db, current_user, tenant_id)
    field = query.filter(FieldDefinition.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="字段不存在或无权限查看")
    return field


@router.put("/{field_id}", response_model=FieldDefinitionResponse)
def update_field_definition(
    field_id: int,
    request: Request,
    data: FieldDefinitionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """更新字段定义"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_field_query(db, current_user, tenant_id)
    field = query.filter(FieldDefinition.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="字段不存在或无权限修改")

    # 不能修改系统字段（除非是超管）
    if field.is_system and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="不能修改系统字段")

    # 不能修改其他租户的字段
    if field.tenant_id is not None and field.tenant_id != current_user.tenant_id and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="无权限修改该字段")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(field, key, value)

    db.commit()
    db.refresh(field)
    return field


@router.delete("/{field_id}")
def delete_field_definition(
    field_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """删除字段定义"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_field_query(db, current_user, tenant_id)
    field = query.filter(FieldDefinition.id == field_id).first()
    if not field:
        raise HTTPException(status_code=404, detail="字段不存在或无权限删除")

    if field.is_system:
        raise HTTPException(status_code=400, detail="系统字段不能删除")

    # 不能删除其他租户的字段
    if field.tenant_id is not None and field.tenant_id != current_user.tenant_id and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="无权限删除该字段")

    db.delete(field)
    db.commit()
    return {"message": "删除成功"}
