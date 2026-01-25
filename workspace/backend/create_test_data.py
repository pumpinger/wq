"""
创建全面的测试数据
数据设计原则：
1. 命名直观，能直接看出数据特征
2. 覆盖各种边界情况
3. 便于人工验证权限、筛选等功能
"""
import sys
sys.path.insert(0, '.')

from passlib.context import CryptContext
from app.database import SessionLocal, engine, Base
from app.models import (
    Tenant, User, Customer, CustomerTemplate, FieldDefinition,
    CustomerFieldValue, CustomerPoolRecord, Role, Permission
)
from app.models.template_field import TemplateField

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_test_data():
    db = SessionLocal()

    try:
        print("=" * 60)
        print("开始创建测试数据...")
        print("=" * 60)

        # ============================================================
        # 1. 创建租户
        # ============================================================
        print("\n[1/8] 创建租户...")

        tenants = [
            Tenant(name="北京总部", code="BJ001", status="active", contact_name="张总", contact_phone="13800000001"),
            Tenant(name="上海分公司", code="SH001", status="active", contact_name="李总", contact_phone="13800000002"),
            Tenant(name="已停用租户", code="STOP01", status="inactive", contact_name="王总", contact_phone="13800000003"),
        ]
        for t in tenants:
            existing = db.query(Tenant).filter(Tenant.code == t.code).first()
            if not existing:
                db.add(t)
        db.commit()

        bj_tenant = db.query(Tenant).filter(Tenant.code == "BJ001").first()
        sh_tenant = db.query(Tenant).filter(Tenant.code == "SH001").first()
        print(f"  - 北京总部 (ID: {bj_tenant.id})")
        print(f"  - 上海分公司 (ID: {sh_tenant.id})")
        print(f"  - 已停用租户")

        # ============================================================
        # 2. 创建用户（各种角色和权限组合）
        # ============================================================
        print("\n[2/8] 创建用户...")

        # 超级管理员
        superadmin = db.query(User).filter(User.username == "superadmin").first()
        if not superadmin:
            superadmin = User(
                username="superadmin",
                password=hash_password("123456"),
                real_name="超级管理员",
                is_super_admin=True,
                role="admin",
                status="active"
            )
            db.add(superadmin)
            db.commit()
        print(f"  超管: superadmin / 123456")

        # 北京租户用户
        bj_users_config = [
            # (用户名, 姓名, 角色, 数据范围, 上级用户名)
            ("bj_admin", "北京管理员", "tenant_admin", "all", None),
            ("bj_manager_张伟", "张伟(经理)", "user", "team", "bj_admin"),
            ("bj_sales_李明", "李明(销售)", "user", "self", "bj_manager_张伟"),
            ("bj_sales_王芳", "王芳(销售)", "user", "self", "bj_manager_张伟"),
            ("bj_sales_陈杰", "陈杰(销售)", "user", "all", "bj_admin"),  # 特殊：普通员工但有全部权限
            ("bj_inactive", "已停用员工", "user", "self", None),  # 停用状态
        ]

        bj_user_map = {}
        for uname, rname, role, scope, manager_name in bj_users_config:
            user = db.query(User).filter(User.username == uname).first()
            if not user:
                manager_id = bj_user_map.get(manager_name).id if manager_name and manager_name in bj_user_map else None
                user = User(
                    username=uname,
                    password=hash_password("123456"),
                    real_name=rname,
                    role=role,
                    data_scope=scope,
                    tenant_id=bj_tenant.id,
                    manager_id=manager_id,
                    status="inactive" if "inactive" in uname else "active"
                )
                db.add(user)
                db.commit()
            bj_user_map[uname] = user
            status_tag = "[停用]" if user.status == "inactive" else ""
            print(f"  北京: {uname} / 123456 - {rname} ({role}, {scope}) {status_tag}")

        # 上海租户用户
        sh_users_config = [
            ("sh_admin", "上海管理员", "tenant_admin", "all", None),
            ("sh_sales_刘洋", "刘洋(销售)", "user", "self", "sh_admin"),
        ]

        sh_user_map = {}
        for uname, rname, role, scope, manager_name in sh_users_config:
            user = db.query(User).filter(User.username == uname).first()
            if not user:
                manager_id = sh_user_map.get(manager_name).id if manager_name and manager_name in sh_user_map else None
                user = User(
                    username=uname,
                    password=hash_password("123456"),
                    real_name=rname,
                    role=role,
                    data_scope=scope,
                    tenant_id=sh_tenant.id,
                    manager_id=manager_id,
                    status="active"
                )
                db.add(user)
                db.commit()
            sh_user_map[uname] = user
            print(f"  上海: {uname} / 123456 - {rname} ({role}, {scope})")

        # ============================================================
        # 3. 创建字段定义
        # ============================================================
        print("\n[3/8] 创建字段定义...")

        fields_config = [
            # (字段key, 名称, 类型, 选项, 租户ID)
            ("industry", "行业", "select", ["互联网", "金融", "制造业", "零售", "医疗", "教育"], bj_tenant.id),
            ("scale", "规模", "select", ["小型(50人以下)", "中型(50-200人)", "大型(200人以上)"], bj_tenant.id),
            ("level", "客户等级", "select", ["A级-重点", "B级-一般", "C级-潜在"], bj_tenant.id),
            ("source", "来源渠道", "select", ["主动拜访", "电话营销", "网络推广", "老客户转介绍"], bj_tenant.id),
            ("tags", "标签", "multi_select", ["VIP", "有预算", "决策快", "需跟进", "已签约"], bj_tenant.id),
            ("contact", "联系人", "text", None, bj_tenant.id),
            ("phone", "联系电话", "text", None, bj_tenant.id),
            ("budget", "预算(万)", "number", None, bj_tenant.id),
            ("next_follow", "下次跟进日期", "date", None, bj_tenant.id),
            # 上海租户的字段
            ("sh_industry", "行业类型", "select", ["科技", "贸易", "服务"], sh_tenant.id),
        ]

        field_map = {}
        for fkey, fname, ftype, options, tid in fields_config:
            # field_key 全局唯一，不考虑 tenant_id
            field = db.query(FieldDefinition).filter(
                FieldDefinition.field_key == fkey
            ).first()
            if not field:
                field = FieldDefinition(
                    field_key=fkey,
                    name=fname,
                    field_type=ftype,
                    options=options,
                    tenant_id=tid
                )
                db.add(field)
                db.commit()
                print(f"  {fname} ({ftype}) - 新建")
            else:
                print(f"  {fname} ({ftype}) - 已存在")
            field_map[fkey] = field

        # ============================================================
        # 4. 创建客户模板
        # ============================================================
        print("\n[4/8] 创建客户模板...")

        # 北京租户模板
        templates_config = [
            ("企业客户", "大中型企业客户", True, bj_tenant.id,
             ["industry", "scale", "level", "contact", "phone", "budget", "tags"]),
            ("小微客户", "小微企业和个体", False, bj_tenant.id,
             ["industry", "source", "contact", "phone"]),
            ("VIP客户", "重点VIP客户", False, bj_tenant.id,
             ["industry", "scale", "level", "contact", "phone", "budget", "tags", "next_follow"]),
            # 上海模板
            ("上海标准模板", "上海分公司标准模板", True, sh_tenant.id,
             ["sh_industry", "contact", "phone"]),
        ]

        template_map = {}
        for tname, desc, is_default, tid, field_keys in templates_config:
            template = db.query(CustomerTemplate).filter(
                CustomerTemplate.name == tname,
                CustomerTemplate.tenant_id == tid
            ).first()
            if not template:
                template = CustomerTemplate(
                    name=tname,
                    description=desc,
                    is_default=is_default,
                    tenant_id=tid
                )
                db.add(template)
                db.commit()

                # 添加模板字段
                for idx, fkey in enumerate(field_keys):
                    if fkey in field_map:
                        tf = TemplateField(
                            template_id=template.id,
                            field_id=field_map[fkey].id,
                            is_required=(idx < 2),  # 前两个字段必填
                            sort_order=idx
                        )
                        db.add(tf)
                db.commit()
            template_map[tname] = template
            print(f"  {tname} - {len(field_keys)}个字段")

        # ============================================================
        # 5. 创建客户数据
        # ============================================================
        print("\n[5/8] 创建客户数据...")

        # 北京客户数据设计：
        # - 不同负责人
        # - 有坐标/无坐标
        # - 不同模板
        # - 公海客户
        # - 不同属性值

        bj_customers = [
            # (名称, 地址, 纬度, 经度, 负责人key, 模板名, 字段值)
            # 张伟经理的客户
            ("【张伟】阿里巴巴北京", "北京市朝阳区望京SOHO", 39.9984, 116.4805, "bj_manager_张伟", "企业客户",
             {"industry": "互联网", "scale": "大型(200人以上)", "level": "A级-重点", "contact": "马云", "phone": "13900001111", "budget": 500, "tags": ["VIP", "已签约"]}),
            ("【张伟】腾讯北京分公司", "北京市海淀区科技园", 39.9842, 116.3074, "bj_manager_张伟", "VIP客户",
             {"industry": "互联网", "scale": "大型(200人以上)", "level": "A级-重点", "contact": "马化腾", "phone": "13900002222", "budget": 800, "tags": ["VIP", "有预算"]}),

            # 李明销售的客户
            ("【李明】小米科技", "北京市海淀区清河", 40.0312, 116.3282, "bj_sales_李明", "企业客户",
             {"industry": "互联网", "scale": "大型(200人以上)", "level": "A级-重点", "contact": "雷军", "phone": "13900003333", "budget": 300, "tags": ["VIP", "决策快"]}),
            ("【李明】无坐标客户A", "北京市西城区金融街", None, None, "bj_sales_李明", "企业客户",
             {"industry": "金融", "scale": "中型(50-200人)", "level": "B级-一般", "contact": "张三", "phone": "13900004444", "budget": 100, "tags": ["需跟进"]}),
            ("【李明】小微客户-便利店", "北京市东城区", 39.9288, 116.4163, "bj_sales_李明", "小微客户",
             {"industry": "零售", "source": "主动拜访", "contact": "李老板", "phone": "13900005555"}),

            # 王芳销售的客户
            ("【王芳】北京医院", "北京市东城区东单", 39.9139, 116.4189, "bj_sales_王芳", "企业客户",
             {"industry": "医疗", "scale": "大型(200人以上)", "level": "B级-一般", "contact": "院长", "phone": "13900006666", "budget": 200, "tags": ["有预算"]}),
            ("【王芳】清华大学", "北京市海淀区清华园", 40.0024, 116.3266, "bj_sales_王芳", "企业客户",
             {"industry": "教育", "scale": "大型(200人以上)", "level": "A级-重点", "contact": "校办", "phone": "13900007777", "budget": 150, "tags": ["VIP"]}),
            ("【王芳】无坐标客户B", None, None, None, "bj_sales_王芳", "小微客户",
             {"industry": "零售", "source": "电话营销", "contact": "王老板", "phone": "13900008888"}),

            # 陈杰(全权限)的客户
            ("【陈杰】京东总部", "北京市大兴区亦庄", 39.7953, 116.5024, "bj_sales_陈杰", "VIP客户",
             {"industry": "互联网", "scale": "大型(200人以上)", "level": "A级-重点", "contact": "刘强东", "phone": "13900009999", "budget": 600, "tags": ["VIP", "已签约", "有预算"]}),

            # 公海客户（无负责人）
            ("【公海】潜在客户-制造业", "北京市通州区", 39.9087, 116.6572, None, "企业客户",
             {"industry": "制造业", "scale": "中型(50-200人)", "level": "C级-潜在", "contact": "赵总", "phone": "13900010001", "budget": 50, "tags": ["需跟进"]}),
            ("【公海】流失客户-金融", "北京市西城区", 39.9128, 116.3663, None, "企业客户",
             {"industry": "金融", "scale": "小型(50人以下)", "level": "C级-潜在", "contact": "钱总", "phone": "13900010002", "budget": 30, "tags": []}),
            ("【公海】无地址客户", None, None, None, None, "小微客户",
             {"industry": "零售", "source": "网络推广", "contact": "孙总", "phone": "13900010003"}),
        ]

        for cname, addr, lat, lng, manager_key, tpl_name, fvalues in bj_customers:
            existing = db.query(Customer).filter(
                Customer.name == cname,
                Customer.tenant_id == bj_tenant.id
            ).first()
            if existing:
                continue

            managed_by = bj_user_map[manager_key].id if manager_key else None
            template = template_map[tpl_name]

            customer = Customer(
                name=cname,
                address=addr,
                latitude=lat,
                longitude=lng,
                managed_by=managed_by,
                template_id=template.id,
                tenant_id=bj_tenant.id
            )
            db.add(customer)
            db.commit()

            # 添加字段值
            for fkey, fval in fvalues.items():
                if fkey in field_map:
                    cfv = CustomerFieldValue(
                        customer_id=customer.id,
                        field_id=field_map[fkey].id,
                        value=fval
                    )
                    db.add(cfv)
            db.commit()

            owner = manager_key.split('_')[-1] if manager_key else "公海"
            coords = "有坐标" if lat else "无坐标"
            print(f"  {cname} [{owner}] [{coords}]")

        # 上海客户
        sh_customers = [
            ("【刘洋】上海科技公司", "上海市浦东新区张江", 31.2033, 121.5908, "sh_sales_刘洋", "上海标准模板",
             {"sh_industry": "科技", "contact": "周总", "phone": "13800001111"}),
            ("【刘洋】上海贸易公司", "上海市黄浦区外滩", 31.2397, 121.4908, "sh_sales_刘洋", "上海标准模板",
             {"sh_industry": "贸易", "contact": "吴总", "phone": "13800002222"}),
            ("【公海】上海潜在客户", "上海市静安区", 31.2288, 121.4479, None, "上海标准模板",
             {"sh_industry": "服务", "contact": "郑总", "phone": "13800003333"}),
        ]

        for cname, addr, lat, lng, manager_key, tpl_name, fvalues in sh_customers:
            existing = db.query(Customer).filter(
                Customer.name == cname,
                Customer.tenant_id == sh_tenant.id
            ).first()
            if existing:
                continue

            managed_by = sh_user_map[manager_key].id if manager_key else None
            template = template_map[tpl_name]

            customer = Customer(
                name=cname,
                address=addr,
                latitude=lat,
                longitude=lng,
                managed_by=managed_by,
                template_id=template.id,
                tenant_id=sh_tenant.id
            )
            db.add(customer)
            db.commit()

            # 添加字段值
            for fkey, fval in fvalues.items():
                if fkey in field_map:
                    cfv = CustomerFieldValue(
                        customer_id=customer.id,
                        field_id=field_map[fkey].id,
                        value=fval
                    )
                    db.add(cfv)
            db.commit()
            print(f"  {cname}")

        # ============================================================
        # 6. 创建公海记录
        # ============================================================
        print("\n[6/8] 创建公海记录...")

        pool_customers = db.query(Customer).filter(
            Customer.managed_by.is_(None),
            Customer.tenant_id == bj_tenant.id
        ).all()

        for pc in pool_customers:
            existing = db.query(CustomerPoolRecord).filter(
                CustomerPoolRecord.customer_id == pc.id
            ).first()
            if not existing:
                record = CustomerPoolRecord(
                    customer_id=pc.id,
                    tenant_id=bj_tenant.id,
                    action="release",
                    from_user_id=bj_user_map["bj_sales_李明"].id,
                    to_user_id=None,
                    reason="客户长期未成交，释放到公海"
                )
                db.add(record)
        db.commit()
        print(f"  为 {len(pool_customers)} 个公海客户创建了释放记录")

        # ============================================================
        # 7. 统计信息
        # ============================================================
        print("\n[7/8] 数据统计...")

        bj_customer_count = db.query(Customer).filter(Customer.tenant_id == bj_tenant.id).count()
        sh_customer_count = db.query(Customer).filter(Customer.tenant_id == sh_tenant.id).count()
        pool_count = db.query(Customer).filter(Customer.managed_by.is_(None)).count()
        with_coords = db.query(Customer).filter(Customer.latitude.isnot(None)).count()

        print(f"  北京客户: {bj_customer_count} 个")
        print(f"  上海客户: {sh_customer_count} 个")
        print(f"  公海客户: {pool_count} 个")
        print(f"  有坐标客户: {with_coords} 个")

        # ============================================================
        # 8. 测试账号汇总
        # ============================================================
        print("\n" + "=" * 60)
        print("测试账号汇总 (密码统一: 123456)")
        print("=" * 60)

        print("""
【超级管理员】
  superadmin          - 可管理所有租户，可进入任意租户上下文

【北京总部】
  bj_admin            - 租户管理员，可看全部数据
  bj_manager_张伟     - 经理，team权限，可看自己+下属(李明、王芳)的数据
  bj_sales_李明       - 销售，self权限，只能看自己的客户
  bj_sales_王芳       - 销售，self权限，只能看自己的客户
  bj_sales_陈杰       - 销售，all权限(特殊)，可看全部客户
  bj_inactive         - 已停用账号，无法登录

【上海分公司】
  sh_admin            - 租户管理员
  sh_sales_刘洋       - 销售

【测试场景建议】
1. 权限测试：
   - 用 bj_sales_李明 登录，应只能看到【李明】开头的客户
   - 用 bj_manager_张伟 登录，应能看到自己和李明、王芳的客户
   - 用 bj_sales_陈杰 登录，应能看到所有北京客户

2. 筛选测试：
   - 按模板筛选：企业客户/小微客户/VIP客户
   - 按负责人筛选：选择不同销售
   - 按坐标筛选：有坐标/无坐标
   - 组合筛选测试

3. 公海测试：
   - 查看公海客户列表
   - 认领公海客户
   - 释放客户到公海

4. 地图测试：
   - 查看客户分布地图
   - 验证有坐标的客户显示在地图上

5. 导出测试：
   - 导出全部客户
   - 筛选后导出

6. 租户隔离测试：
   - 北京账号看不到上海客户
   - 超管可以切换租户查看
        """)

        print("=" * 60)
        print("测试数据创建完成！")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"错误: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_test_data()
