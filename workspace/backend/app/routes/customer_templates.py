from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional

from ..database import get_db
from ..models import CustomerTemplate, TemplateField, FieldDefinition
from ..models.user import User
from ..schemas import (
    CustomerTemplateCreate, CustomerTemplateUpdate,
    CustomerTemplateResponse, CustomerTemplateDetail
)
from ..core.deps import get_current_active_user, require_tenant_admin, get_effective_tenant_id, require_tenant_context

router = APIRouter(prefix="/customer-templates", tags=["客户模板"])


def get_template_query(db: Session, current_user: User, tenant_id: Optional[int] = None):
    """根据用户权限构建模板查询 - 系统模板 + 租户自定义模板"""
    from sqlalchemy import or_

    query = db.query(CustomerTemplate)

    # 确定有效的租户ID
    effective_tenant_id = tenant_id if current_user.is_super_admin else current_user.tenant_id

    if current_user.is_super_admin and effective_tenant_id is None:
        # 超管未选择租户时，返回所有模板
        return query

    # 租户可见模板 = 系统模板(tenant_id=NULL) + 自定义模板(tenant_id=租户ID)
    if effective_tenant_id:
        query = query.filter(
            or_(
                CustomerTemplate.tenant_id == None,  # 系统模板
                CustomerTemplate.tenant_id == effective_tenant_id  # 租户自定义模板
            )
        )
    else:
        # 没有租户的用户只能看系统模板
        query = query.filter(CustomerTemplate.tenant_id == None)

    return query


@router.get("/", response_model=List[CustomerTemplateResponse])
def list_templates(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取所有客户模板"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_template_query(db, current_user, tenant_id)
    return query.all()


@router.post("/", response_model=CustomerTemplateDetail)
def create_template(
    request: Request,
    data: CustomerTemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """创建客户模板"""
    tenant_id = require_tenant_context(request, current_user)

    # 如果设为默认，先取消本租户其他默认
    if data.is_default:
        db.query(CustomerTemplate).filter(
            CustomerTemplate.is_default == True,
            CustomerTemplate.tenant_id == tenant_id
        ).update({"is_default": False})

    template = CustomerTemplate(
        name=data.name,
        description=data.description,
        is_default=data.is_default,
        tenant_id=tenant_id
    )
    db.add(template)
    db.flush()

    # 添加字段关联
    for field_data in data.fields:
        field = db.query(FieldDefinition).filter(FieldDefinition.id == field_data.field_id).first()
        if not field:
            raise HTTPException(status_code=400, detail=f"字段ID {field_data.field_id} 不存在")

        template_field = TemplateField(
            template_id=template.id,
            field_id=field_data.field_id,
            is_required=field_data.is_required,
            sort_order=field_data.sort_order,
            options=field_data.options
        )
        db.add(template_field)

    db.commit()
    db.refresh(template)

    # 重新加载关联
    template = db.query(CustomerTemplate).options(
        joinedload(CustomerTemplate.template_fields).joinedload(TemplateField.field)
    ).filter(CustomerTemplate.id == template.id).first()

    return template


@router.get("/{template_id}", response_model=CustomerTemplateDetail)
def get_template(
    template_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取模板详情"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_template_query(db, current_user, tenant_id)
    template = query.options(
        joinedload(CustomerTemplate.template_fields).joinedload(TemplateField.field)
    ).filter(CustomerTemplate.id == template_id).first()

    if not template:
        raise HTTPException(status_code=404, detail="模板不存在或无权限查看")
    return template


@router.put("/{template_id}", response_model=CustomerTemplateDetail)
def update_template(
    template_id: int,
    request: Request,
    data: CustomerTemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """更新模板"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_template_query(db, current_user, tenant_id)
    template = query.filter(CustomerTemplate.id == template_id).first()

    if not template:
        raise HTTPException(status_code=404, detail="模板不存在或无权限修改")

    # 不能修改系统模板（除非是超管）
    if template.tenant_id is None and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="不能修改系统模板")

    # 更新基本信息
    if data.name is not None:
        template.name = data.name
    if data.description is not None:
        template.description = data.description
    if data.is_default is not None:
        if data.is_default:
            db.query(CustomerTemplate).filter(
                CustomerTemplate.is_default == True,
                CustomerTemplate.tenant_id == template.tenant_id
            ).update({"is_default": False})
        template.is_default = data.is_default

    # 更新字段关联
    if data.fields is not None:
        # 删除旧的关联
        db.query(TemplateField).filter(TemplateField.template_id == template_id).delete()

        # 添加新的关联
        for field_data in data.fields:
            field = db.query(FieldDefinition).filter(FieldDefinition.id == field_data.field_id).first()
            if not field:
                raise HTTPException(status_code=400, detail=f"字段ID {field_data.field_id} 不存在")

            template_field = TemplateField(
                template_id=template.id,
                field_id=field_data.field_id,
                is_required=field_data.is_required,
                sort_order=field_data.sort_order,
                options=field_data.options
            )
            db.add(template_field)

    db.commit()

    # 重新加载
    template = db.query(CustomerTemplate).options(
        joinedload(CustomerTemplate.template_fields).joinedload(TemplateField.field)
    ).filter(CustomerTemplate.id == template_id).first()

    return template


@router.delete("/{template_id}")
def delete_template(
    template_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_tenant_admin)
):
    """删除模板"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_template_query(db, current_user, tenant_id)
    template = query.filter(CustomerTemplate.id == template_id).first()

    if not template:
        raise HTTPException(status_code=404, detail="模板不存在或无权限删除")

    # 不能删除系统模板（除非是超管）
    if template.tenant_id is None and not current_user.is_super_admin:
        raise HTTPException(status_code=403, detail="不能删除系统模板")

    db.delete(template)
    db.commit()
    return {"message": "删除成功"}
