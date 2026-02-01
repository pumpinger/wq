"""
数据库初始化脚本 - 新安装时运行一次
功能：建表 + 创建超级管理员 + 初始化权限/角色 + 初始化预设字段和模板

用法：cd workspace/backend && python setup_db.py
"""
import os
import sys

sys.stdout.reconfigure(encoding='utf-8')

from dotenv import load_dotenv
load_dotenv()

from app.database import engine, Base, SessionLocal
from app.core.security import get_password_hash
from app.models import (
    FieldDefinition, CustomerTemplate, TemplateField,
    Permission, Role, User,
)
from app.models.role import RolePermission
from app.models.field_definition import FieldType
from sqlalchemy import text


def create_tables():
    """创建所有数据库表（已存在的表会跳过，不会丢失数据）"""
    print("[1/5] 创建数据库表...")
    # 导入所有模型确保 metadata 完整
    import app.models  # noqa
    Base.metadata.create_all(bind=engine)
    print("  OK - 表结构已就绪")


def create_super_admin(db):
    """创建超级管理员账号"""
    print("[2/5] 创建超级管理员...")

    existing = db.query(User).filter(User.is_super_admin == True).first()
    if existing:
        print(f"  SKIP - 超级管理员已存在 (username={existing.username})")
        return

    username = os.getenv("SUPER_ADMIN_USERNAME", "superadmin")
    password = os.getenv("SUPER_ADMIN_PASSWORD", "admin123")

    admin = User(
        username=username,
        password=get_password_hash(password),
        real_name="Super Admin",
        role="super_admin",
        status="active",
        is_super_admin=True,
    )
    db.add(admin)
    db.commit()
    print(f"  OK - 超级管理员已创建")
    print(f"       用户名: {username}")
    print(f"       密码: {password}")
    print(f"       ⚠ 请登录后立即修改密码!")


def init_permissions_and_roles(db):
    """初始化系统权限和角色"""
    print("[3/5] 初始化权限和角色...")

    # --- 权限定义 ---
    permissions_data = [
        ('customer', 'view', '查看客户', '查看客户列表和详情'),
        ('customer', 'create', '创建客户', '创建新客户'),
        ('customer', 'edit', '编辑客户', '编辑客户信息'),
        ('customer', 'delete', '删除客户', '删除客户'),
        ('customer', 'transfer', '转移客户', '转移客户跟进人'),
        ('template', 'view', '查看模板', '查看客户模板'),
        ('template', 'manage', '管理模板', '创建、编辑、删除模板'),
        ('field', 'view', '查看字段', '查看字段定义'),
        ('field', 'manage', '管理字段', '创建、编辑、删除字段'),
        ('user', 'view', '查看员工', '查看员工列表'),
        ('user', 'manage', '管理员工', '创建、编辑、删除员工'),
        ('role', 'manage', '管理角色', '创建、编辑、删除角色'),
    ]

    perm_count = 0
    perm_map = {}  # module:action -> Permission object
    for module, action, name, desc in permissions_data:
        existing = db.query(Permission).filter(
            Permission.module == module, Permission.action == action
        ).first()
        if existing:
            perm_map[f"{module}:{action}"] = existing
        else:
            p = Permission(module=module, action=action, name=name, description=desc)
            db.add(p)
            db.flush()
            perm_map[f"{module}:{action}"] = p
            perm_count += 1

    print(f"  权限: 新增 {perm_count} 条，共 {len(perm_map)} 条")

    # --- 系统角色 ---
    roles_data = [
        ('tenant_admin', '租户管理员', '拥有租户内所有权限', 'all'),
        ('manager', '部门经理', '管理团队客户，查看员工', 'team'),
        ('sales', '销售员', '管理自己的客户', 'self'),
    ]

    role_perms_mapping = {
        'tenant_admin': list(perm_map.keys()),  # 全部权限
        'manager': [
            'customer:view', 'customer:create', 'customer:edit',
            'customer:delete', 'customer:transfer',
            'template:view', 'field:view', 'user:view',
        ],
        'sales': [
            'customer:view', 'customer:create', 'customer:edit',
            'template:view', 'field:view',
        ],
    }

    # 每个角色的权限数据范围
    scope_defaults = {
        'tenant_admin': 'all',
        'manager': 'team',
        'sales': 'self',
    }

    role_count = 0
    for code, name, desc, scope in roles_data:
        existing = db.query(Role).filter(
            Role.code == code, Role.tenant_id == None, Role.is_system == True
        ).first()
        if existing:
            continue

        role = Role(
            tenant_id=None, name=name, code=code,
            description=desc, is_system=True, data_scope=scope,
        )
        db.add(role)
        db.flush()

        # 分配权限
        for perm_code in role_perms_mapping.get(code, []):
            perm = perm_map.get(perm_code)
            if perm:
                rp = RolePermission(
                    role_id=role.id,
                    permission_id=perm.id,
                    data_scope=scope_defaults.get(code, 'self'),
                )
                db.add(rp)

        role_count += 1

    db.commit()
    print(f"  角色: 新增 {role_count} 个，共 {len(roles_data)} 个")


def init_fields_and_template(db):
    """初始化预设字段和默认模板"""
    print("[4/5] 初始化预设字段和模板...")

    system_fields = [
        {"name": "行业", "field_key": "industry", "field_type": FieldType.SELECT,
         "options": ["制造业", "零售业", "服务业", "金融业", "医疗健康", "教育", "科技", "其他"],
         "is_system": True},
        {"name": "客户等级", "field_key": "level", "field_type": FieldType.SELECT,
         "options": ["A级(重要)", "B级(一般)", "C级(潜在)", "D级(休眠)"],
         "is_system": True},
        {"name": "区域", "field_key": "region", "field_type": FieldType.SELECT,
         "options": ["华东", "华南", "华北", "华中", "西南", "西北", "东北"],
         "is_system": True},
        {"name": "客户来源", "field_key": "source", "field_type": FieldType.SELECT,
         "options": ["主动拜访", "客户推荐", "网络获客", "展会活动", "电话营销", "其他"],
         "is_system": True},
        {"name": "合作产品", "field_key": "products", "field_type": FieldType.MULTI_SELECT,
         "options": ["产品A", "产品B", "产品C", "产品D", "产品E"],
         "is_system": True},
        {"name": "联系人", "field_key": "contact_name", "field_type": FieldType.TEXT,
         "options": None, "is_system": True},
        {"name": "联系电话", "field_key": "contact_phone", "field_type": FieldType.TEXT,
         "options": None, "is_system": True},
        {"name": "年营业额(万)", "field_key": "annual_revenue", "field_type": FieldType.NUMBER,
         "options": None, "is_system": True},
        {"name": "成立日期", "field_key": "established_date", "field_type": FieldType.DATE,
         "options": None, "is_system": True},
        {"name": "服务标签", "field_key": "service_tags", "field_type": FieldType.MULTI_SELECT,
         "options": ["VIP服务", "定制服务", "标准服务", "远程支持", "现场支持"],
         "is_system": True},
    ]

    field_count = 0
    for fd in system_fields:
        existing = db.query(FieldDefinition).filter(
            FieldDefinition.field_key == fd["field_key"]
        ).first()
        if not existing:
            db.add(FieldDefinition(**fd))
            field_count += 1
    db.commit()
    print(f"  字段: 新增 {field_count} 个，共 {len(system_fields)} 个")

    # 默认模板
    existing_tpl = db.query(CustomerTemplate).filter(
        CustomerTemplate.name == "标准客户模板"
    ).first()
    if existing_tpl:
        print("  模板: SKIP - 默认模板已存在")
        return

    template = CustomerTemplate(
        name="标准客户模板",
        description="包含常用字段的标准客户录入模板",
        is_default=True,
    )
    db.add(template)
    db.flush()

    common_keys = ["industry", "level", "region", "contact_name", "contact_phone"]
    fields = db.query(FieldDefinition).filter(
        FieldDefinition.field_key.in_(common_keys)
    ).all()
    for i, field in enumerate(fields):
        tf = TemplateField(
            template_id=template.id,
            field_id=field.id,
            is_required=(field.field_key in ["industry", "level"]),
            sort_order=i,
        )
        db.add(tf)

    db.commit()
    print(f"  模板: 已创建默认模板，包含 {len(fields)} 个字段")


def main():
    print("=" * 50)
    print("外勤管理系统 - 数据库初始化")
    print("=" * 50)
    print()

    create_tables()

    db = SessionLocal()
    try:
        create_super_admin(db)
        init_permissions_and_roles(db)
        init_fields_and_template(db)
    finally:
        db.close()

    print()
    print("[5/5] 初始化完成!")
    print()
    print("=" * 50)
    print("现在可以启动服务了:")
    print("  cd workspace/backend")
    print("  uvicorn app.main:app --reload")
    print("=" * 50)


if __name__ == "__main__":
    main()
