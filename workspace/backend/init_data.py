"""初始化预设数据"""
from app.database import SessionLocal, engine, Base
from app.models import FieldDefinition, CustomerTemplate, TemplateField
from app.models.field_definition import FieldType

# 创建所有表
Base.metadata.create_all(bind=engine)


def init_field_definitions(db):
    """初始化系统预设字段"""
    system_fields = [
        {
            "name": "行业",
            "field_key": "industry",
            "field_type": FieldType.SELECT,
            "options": ["制造业", "零售业", "服务业", "金融业", "医疗健康", "教育", "科技", "其他"],
            "is_system": True
        },
        {
            "name": "客户等级",
            "field_key": "level",
            "field_type": FieldType.SELECT,
            "options": ["A级(重要)", "B级(一般)", "C级(潜在)", "D级(休眠)"],
            "is_system": True
        },
        {
            "name": "区域",
            "field_key": "region",
            "field_type": FieldType.SELECT,
            "options": ["华东", "华南", "华北", "华中", "西南", "西北", "东北"],
            "is_system": True
        },
        {
            "name": "客户来源",
            "field_key": "source",
            "field_type": FieldType.SELECT,
            "options": ["主动拜访", "客户推荐", "网络获客", "展会活动", "电话营销", "其他"],
            "is_system": True
        },
        {
            "name": "合作产品",
            "field_key": "products",
            "field_type": FieldType.MULTI_SELECT,
            "options": ["产品A", "产品B", "产品C", "产品D", "产品E"],
            "is_system": True
        },
        {
            "name": "联系人",
            "field_key": "contact_name",
            "field_type": FieldType.TEXT,
            "options": None,
            "is_system": True
        },
        {
            "name": "联系电话",
            "field_key": "contact_phone",
            "field_type": FieldType.TEXT,
            "options": None,
            "is_system": True
        },
        {
            "name": "年营业额(万)",
            "field_key": "annual_revenue",
            "field_type": FieldType.NUMBER,
            "options": None,
            "is_system": True
        },
        {
            "name": "成立日期",
            "field_key": "established_date",
            "field_type": FieldType.DATE,
            "options": None,
            "is_system": True
        },
        {
            "name": "服务标签",
            "field_key": "service_tags",
            "field_type": FieldType.MULTI_SELECT,
            "options": ["VIP服务", "定制服务", "标准服务", "远程支持", "现场支持"],
            "is_system": True
        }
    ]

    created = 0
    for field_data in system_fields:
        existing = db.query(FieldDefinition).filter(FieldDefinition.field_key == field_data["field_key"]).first()
        if not existing:
            field = FieldDefinition(**field_data)
            db.add(field)
            created += 1

    db.commit()
    print(f"创建了 {created} 个系统字段")
    return created


def init_default_template(db):
    """初始化默认模板"""
    existing = db.query(CustomerTemplate).filter(CustomerTemplate.name == "标准客户模板").first()
    if existing:
        print("默认模板已存在")
        return

    # 创建默认模板
    template = CustomerTemplate(
        name="标准客户模板",
        description="包含常用字段的标准客户录入模板",
        is_default=True
    )
    db.add(template)
    db.flush()

    # 关联常用字段
    common_fields = ["industry", "level", "region", "contact_name", "contact_phone"]
    fields = db.query(FieldDefinition).filter(FieldDefinition.field_key.in_(common_fields)).all()

    for i, field in enumerate(fields):
        template_field = TemplateField(
            template_id=template.id,
            field_id=field.id,
            is_required=(field.field_key in ["industry", "level"]),
            sort_order=i
        )
        db.add(template_field)

    db.commit()
    print(f"创建了默认模板，包含 {len(fields)} 个字段")


def main():
    db = SessionLocal()
    try:
        print("开始初始化数据...")
        init_field_definitions(db)
        init_default_template(db)
        print("数据初始化完成!")
    finally:
        db.close()


if __name__ == "__main__":
    main()
