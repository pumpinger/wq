from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_, and_, exists
from typing import List, Optional
from datetime import datetime, date
from io import BytesIO
import json
from openpyxl import Workbook

from ..database import get_db
from ..models import Customer, CustomerFieldValue, CustomerTemplate, TemplateField, FieldDefinition
from ..models.user import User
from ..models.tenant import Tenant
from ..models.region import UserRegion
from ..schemas import CustomerCreate, CustomerUpdate, CustomerResponse, CustomerDetail
from ..schemas.customer import CustomFieldFilter, CustomFieldFilterOperator
from ..core.deps import get_current_active_user, get_effective_tenant_id, require_tenant_context

router = APIRouter(prefix="/customers", tags=["客户管理"])


def get_subordinate_ids(db: Session, user_id: int) -> List[int]:
    """获取直属下属的用户ID列表"""
    subordinates = db.query(User).filter(User.manager_id == user_id).all()
    return [u.id for u in subordinates]


def get_user_region_ids(db: Session, user_id: int) -> list[int]:
    """获取用户负责的区域ID列表"""
    user_regions = db.query(UserRegion).filter(UserRegion.user_id == user_id).all()
    return [ur.region_id for ur in user_regions]


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

    # 超管或租户管理员可以看全部（不受区域限制）
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

    # 区域权限过滤
    if effective_tenant_id:
        tenant_obj = db.query(Tenant).filter(Tenant.id == effective_tenant_id).first()
        if tenant_obj and tenant_obj.enable_region_scope:
            user_region_ids = get_user_region_ids(db, current_user.id)
            if user_region_ids:
                query = query.filter(Customer.region_id.in_(user_region_ids))
            else:
                # 未分配区域的员工只能看到未分配区域的客户
                query = query.filter(Customer.region_id.is_(None))

    return query


def apply_custom_filters(query, custom_filters: List[CustomFieldFilter], db: Session):
    """应用自定义字段筛选条件

    JSON 字段存储说明：
    - text: 存储为 JSON 字符串，如 "hello world"
    - number: 存储为 JSON 数字，如 123 或 123.45
    - date: 存储为 JSON 字符串，如 "2024-01-15"
    - select: 存储为 JSON 字符串，如 "选项A"
    - multi_select: 存储为 JSON 数组，如 ["选项A", "选项B"]
    """
    # 预先批量查询所有需要的字段定义，避免 N+1 问题
    field_ids = [cf.field_id for cf in custom_filters]
    field_defs = {f.id: f for f in db.query(FieldDefinition).filter(FieldDefinition.id.in_(field_ids)).all()}

    for cf in custom_filters:
        field_id = cf.field_id
        operator = cf.operator
        value = cf.value

        field_def = field_defs.get(field_id)
        if not field_def:
            continue

        # 构建子查询条件
        if operator == CustomFieldFilterOperator.EQ:
            # 精确匹配（select 类型）- JSON 字符串存储
            subquery = exists().where(
                and_(
                    CustomerFieldValue.customer_id == Customer.id,
                    CustomerFieldValue.field_id == field_id,
                    CustomerFieldValue.value == value  # SQLAlchemy JSON 类型会自动处理比较
                )
            )
        elif operator == CustomFieldFilterOperator.CONTAINS:
            # 模糊匹配（text 类型）
            # JSON 字符串存储为 "xxx"，使用 contains 在字符串内容中搜索
            subquery = exists().where(
                and_(
                    CustomerFieldValue.customer_id == Customer.id,
                    CustomerFieldValue.field_id == field_id,
                    CustomerFieldValue.value.as_string().contains(value)
                )
            )
        elif operator == CustomFieldFilterOperator.GTE:
            # 大于等于（number/date 类型）
            if field_def.field_type.value == 'number':
                try:
                    num_value = float(value)
                    subquery = exists().where(
                        and_(
                            CustomerFieldValue.customer_id == Customer.id,
                            CustomerFieldValue.field_id == field_id,
                            CustomerFieldValue.value.as_float() >= num_value
                        )
                    )
                except (ValueError, TypeError):
                    continue
            else:  # date - ISO 格式字符串比较（YYYY-MM-DD 字典序等于日期序）
                subquery = exists().where(
                    and_(
                        CustomerFieldValue.customer_id == Customer.id,
                        CustomerFieldValue.field_id == field_id,
                        CustomerFieldValue.value >= value  # JSON 字符串按字典序比较
                    )
                )
        elif operator == CustomFieldFilterOperator.LTE:
            # 小于等于（number/date 类型）
            if field_def.field_type.value == 'number':
                try:
                    num_value = float(value)
                    subquery = exists().where(
                        and_(
                            CustomerFieldValue.customer_id == Customer.id,
                            CustomerFieldValue.field_id == field_id,
                            CustomerFieldValue.value.as_float() <= num_value
                        )
                    )
                except (ValueError, TypeError):
                    continue
            else:  # date
                subquery = exists().where(
                    and_(
                        CustomerFieldValue.customer_id == Customer.id,
                        CustomerFieldValue.field_id == field_id,
                        CustomerFieldValue.value <= value
                    )
                )
        elif operator == CustomFieldFilterOperator.IN:
            # 包含任意一个（multi_select 类型）
            # 存储格式为 JSON 数组 ["选项A", "选项B"]
            # 筛选值为 ["选项A", "选项C"]，匹配有交集的记录
            if isinstance(value, list) and len(value) > 0:
                # 使用精确的 JSON 元素匹配，避免 "apple" 匹配 "pineapple" 的问题
                # 匹配模式: "选项A" 后跟 ] 或 , 表示是完整元素
                conditions = []
                for v in value:
                    # 构建精确匹配模式: 匹配 JSON 数组中的完整元素
                    # 例如对于 "选项A"，匹配 "选项A"] 或 "选项A",
                    json_element = json.dumps(v, ensure_ascii=False)  # 得到 "选项A"
                    conditions.append(
                        CustomerFieldValue.value.as_string().contains(json_element)
                    )
                subquery = exists().where(
                    and_(
                        CustomerFieldValue.customer_id == Customer.id,
                        CustomerFieldValue.field_id == field_id,
                        or_(*conditions)
                    )
                )
            else:
                continue
        else:
            continue

        query = query.filter(subquery)

    return query


def apply_standard_filters(
    query,
    db: Session,
    template_id: Optional[int] = None,
    keyword: Optional[str] = None,
    managed_by: Optional[int] = None,
    has_coords: Optional[bool] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    custom_filters: Optional[str] = None,
):
    """应用标准筛选条件（列表和导出共用）"""
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

    if custom_filters:
        try:
            filters_data = json.loads(custom_filters)
            filters_list = [CustomFieldFilter(**f) for f in filters_data]
            query = apply_custom_filters(query, filters_list, db)
        except (json.JSONDecodeError, ValueError):
            pass

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
    custom_filters: Optional[str] = Query(None, description="自定义字段筛选条件，JSON格式"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """获取客户列表（支持多维度筛选）"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_customer_query(db, current_user, tenant_id)
    query = apply_standard_filters(
        query, db,
        template_id=template_id, keyword=keyword, managed_by=managed_by,
        has_coords=has_coords, start_date=start_date, end_date=end_date,
        custom_filters=custom_filters,
    )

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
    custom_filters: Optional[str] = Query(None, description="自定义字段筛选条件，JSON格式"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """导出客户为 Excel"""
    tenant_id = get_effective_tenant_id(request, current_user)
    query = get_customer_query(db, current_user, tenant_id)
    query = apply_standard_filters(
        query, db,
        template_id=template_id, keyword=keyword, managed_by=managed_by,
        has_coords=has_coords, start_date=start_date, end_date=end_date,
        custom_filters=custom_filters,
    )

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
        tenant_id=tenant_id,
        region_id=data.region_id
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
    if data.region_id is not None:
        customer.region_id = data.region_id

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
