from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_
from typing import List, Optional
from datetime import datetime, date
from io import BytesIO
from openpyxl import Workbook

from ..database import get_db
from ..models import Customer, CustomerFieldValue, CustomerTemplate, TemplateField, FieldDefinition
from ..models.user import User
from ..schemas import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerDetail
from ..core.deps import get_current_active_user, get_effective_tenant_id, require_tenant_context

router = APIRouter(prefix="/customers", tags=["客户管理"])


def get_subordinate_ids(db: Session, user_id: int) -> List[int]:
    """获取直属下属的用户ID列表"""
    subordinates = db.query(User).filter(User.manager_id == user_id).all()
    return [u.id for u in subordinates]


def get_customer_query(db: Session, current_user: User, tenant_id: Optional[int] = None):
    """根据用户权限构建客户查询"""
    query = db.query(Customer)

    # 确定有效的租户ID
    effective_tenant_id = tenant_id if current_user.is_super_admin else current_user.tenant_id

    # 租户数据隔离
    if effective_tenant_id:
        query = query.filter(Customer.tenant_id == effective_tenant_id)
    elif current_user.is_super_admin and not tenant_id:
        # 超管未选择租户时，返回所有
        return query

    # 超管或租户管理员可以看全部
    if current_user.is_super_admin or current_user.role == 'tenant_admin':
        return query

    # 根据 data_scope 决定数据权限
    data_scope = current_user.data_scope or 'self'

    if data_scope == 'all':
        # 看租户内全部客户
        pass
    elif data_scope == 'team':
        # 看自己 + 直属下属的客户
        subordinate_ids = get_subordinate_ids(db, current_user.id)
        user_ids = [current_user.id] + subordinate_ids
        query = query.filter(Customer.managed_by.in_(user_ids))
    else:  # self
        # 只看自己负责的客户
        query = query.filter(Customer.managed_by == current_user.id)

    return query


@router.get("/", response_model=List[CustomerResponse])
def list_customers(
    request: Request,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    template_id: Optional[int] = None,
    keyword: Optional[str] = None,
    managed_by: Optional[int] = None,
    has_coords: Optional[bool] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取客户列表（支持多维度筛选）"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_customer_query(db, current_user, tenant_id)

    # 按模板筛选
    if template_id:
        query = query.filter(Customer.template_id == template_id)

    # 按关键词筛选（名称或地址）
    if keyword:
        query = query.filter(
            or_(
                Customer.name.contains(keyword),
                Customer.address.contains(keyword)
            )
        )

    # 按负责人筛选
    if managed_by is not None:
        if managed_by == 0:
            # 0 表示公海客户（无负责人）
            query = query.filter(Customer.managed_by.is_(None))
        else:
            query = query.filter(Customer.managed_by == managed_by)

    # 按是否有坐标筛选
    if has_coords is not None:
        if has_coords:
            query = query.filter(Customer.latitude.isnot(None), Customer.longitude.isnot(None))
        else:
            query = query.filter(or_(Customer.latitude.is_(None), Customer.longitude.is_(None)))

    # 按创建时间范围筛选
    if start_date:
        query = query.filter(Customer.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(Customer.created_at <= datetime.combine(end_date, datetime.max.time()))

    return query.order_by(Customer.created_at.desc()).offset(skip).limit(limit).all()


# 注意：导出路由必须在 /{customer_id} 之前定义，否则会被当作 customer_id 匹配
@router.get("/export/excel")
def export_customers(
    request: Request,
    template_id: Optional[int] = None,
    keyword: Optional[str] = None,
    managed_by: Optional[int] = None,
    has_coords: Optional[bool] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """导出客户为 Excel"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_customer_query(db, current_user, tenant_id)

    # 应用筛选条件
    if template_id:
        query = query.filter(Customer.template_id == template_id)

    if keyword:
        query = query.filter(
            or_(
                Customer.name.contains(keyword),
                Customer.address.contains(keyword)
            )
        )

    if managed_by is not None:
        if managed_by == 0:
            query = query.filter(Customer.managed_by.is_(None))
        else:
            query = query.filter(Customer.managed_by == managed_by)

    if has_coords is not None:
        if has_coords:
            query = query.filter(Customer.latitude.isnot(None), Customer.longitude.isnot(None))
        else:
            query = query.filter(or_(Customer.latitude.is_(None), Customer.longitude.is_(None)))

    if start_date:
        query = query.filter(Customer.created_at >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        query = query.filter(Customer.created_at <= datetime.combine(end_date, datetime.max.time()))

    customers = query.options(joinedload(Customer.field_values)).order_by(Customer.created_at.desc()).all()

    # 获取所有字段定义
    field_definitions = {f.id: f for f in db.query(FieldDefinition).all()}

    # 获取模板信息
    templates = {t.id: t for t in db.query(CustomerTemplate).all()}

    # 获取用户信息（负责人）
    user_ids = list(set(c.managed_by for c in customers if c.managed_by))
    users = {u.id: u.real_name or u.username for u in db.query(User).filter(User.id.in_(user_ids)).all()} if user_ids else {}

    # 收集所有用到的字段
    all_field_ids = set()
    for c in customers:
        for fv in c.field_values or []:
            all_field_ids.add(fv.field_id)

    sorted_field_ids = sorted(all_field_ids)

    # 创建 Excel 工作簿
    wb = Workbook()
    ws = wb.active
    ws.title = "客户列表"

    # 表头
    headers = ["ID", "客户名称", "地址", "纬度", "经度", "模板", "负责人", "创建时间"]
    for field_id in sorted_field_ids:
        field = field_definitions.get(field_id)
        headers.append(field.name if field else f"字段{field_id}")
    ws.append(headers)

    # 数据行
    for c in customers:
        template_name = templates.get(c.template_id).name if c.template_id and c.template_id in templates else ""
        manager_name = users.get(c.managed_by, "") if c.managed_by else ""

        row = [
            c.id,
            c.name,
            c.address or "",
            float(c.latitude) if c.latitude else "",
            float(c.longitude) if c.longitude else "",
            template_name,
            manager_name,
            c.created_at.strftime("%Y-%m-%d %H:%M:%S") if c.created_at else "",
        ]

        # 添加自定义字段值
        field_value_map = {fv.field_id: fv.value for fv in (c.field_values or [])}
        for field_id in sorted_field_ids:
            value = field_value_map.get(field_id, "")
            if isinstance(value, list):
                value = ", ".join(str(v) for v in value)
            row.append(str(value) if value else "")

        ws.append(row)

    # 调整列宽
    for column_cells in ws.columns:
        max_length = 0
        column = column_cells[0].column_letter
        for cell in column_cells:
            try:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            except:
                pass
        ws.column_dimensions[column].width = min(max_length + 2, 50)

    # 保存到内存
    output = BytesIO()
    wb.save(output)
    output.seek(0)

    # 返回文件
    filename = f"customers_{tenant_id or 'all'}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.post("/", response_model=CustomerDetail)
def create_customer(
    request: Request,
    data: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """创建客户"""
    # 验证模板存在
    template = db.query(CustomerTemplate).filter(CustomerTemplate.id == data.template_id).first()
    if not template:
        raise HTTPException(status_code=400, detail="模板不存在")

    # 确定租户ID
    tenant_id = require_tenant_context(request, current_user)

    # 确定负责人（默认为当前用户）
    managed_by = data.managed_by if data.managed_by else current_user.id

    # 创建客户
    customer = Customer(
        name=data.name,
        address=data.address,
        latitude=data.latitude,
        longitude=data.longitude,
        managed_by=managed_by,
        template_id=data.template_id,
        tenant_id=tenant_id
    )
    db.add(customer)
    db.flush()

    # 添加字段值
    for fv_data in data.field_values:
        field_value = CustomerFieldValue(
            customer_id=customer.id,
            field_id=fv_data.field_id,
            value=fv_data.value
        )
        db.add(field_value)

    db.commit()
    db.refresh(customer)

    # 重新加载关联
    customer = db.query(Customer).options(
        joinedload(Customer.field_values)
    ).filter(Customer.id == customer.id).first()

    return customer


@router.get("/{customer_id}", response_model=CustomerDetail)
def get_customer(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取客户详情"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_customer_query(db, current_user, tenant_id)
    customer = query.options(
        joinedload(Customer.field_values)
    ).filter(Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在或无权限查看")
    return customer


@router.put("/{customer_id}", response_model=CustomerDetail)
def update_customer(
    customer_id: int,
    request: Request,
    data: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """更新客户"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_customer_query(db, current_user, tenant_id)
    customer = query.filter(Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在或无权限修改")

    # 更新基本信息
    if data.name is not None:
        customer.name = data.name
    if data.address is not None:
        customer.address = data.address
    if data.latitude is not None:
        customer.latitude = data.latitude
    if data.longitude is not None:
        customer.longitude = data.longitude
    if data.managed_by is not None:
        # 只有管理员可以修改负责人
        if current_user.role in ['admin', 'tenant_admin'] or current_user.is_super_admin:
            customer.managed_by = data.managed_by

    # 更新字段值
    if data.field_values is not None:
        # 删除旧的字段值
        db.query(CustomerFieldValue).filter(CustomerFieldValue.customer_id == customer_id).delete()

        # 添加新的字段值
        for fv_data in data.field_values:
            field_value = CustomerFieldValue(
                customer_id=customer.id,
                field_id=fv_data.field_id,
                value=fv_data.value
            )
            db.add(field_value)

    db.commit()

    # 重新加载
    customer = db.query(Customer).options(
        joinedload(Customer.field_values)
    ).filter(Customer.id == customer_id).first()

    return customer


@router.delete("/{customer_id}")
def delete_customer(
    customer_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """删除客户"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_customer_query(db, current_user, tenant_id)
    customer = query.filter(Customer.id == customer_id).first()

    if not customer:
        raise HTTPException(status_code=404, detail="客户不存在或无权限删除")

    db.delete(customer)
    db.commit()
    return {"message": "删除成功"}
