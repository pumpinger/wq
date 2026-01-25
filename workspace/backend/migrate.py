"""数据库迁移脚本"""
from sqlalchemy import text
from app.database import engine

migrations = [
    # 添加 template_id 字段到 tn_customers 表
    """
    ALTER TABLE tn_customers
    ADD COLUMN template_id INT NULL
    AFTER managed_by
    """,

    # 添加外键约束
    """
    ALTER TABLE tn_customers
    ADD CONSTRAINT fk_customer_template
    FOREIGN KEY (template_id) REFERENCES tn_customer_templates(id)
    ON DELETE SET NULL
    """,

    # 添加 options 字段到 tn_template_fields 表（用于模板级别的字段选项配置）
    """
    ALTER TABLE tn_template_fields
    ADD COLUMN options JSON NULL
    COMMENT '该模板中此字段的选项值'
    """,
]

def run_migrations():
    with engine.connect() as conn:
        for i, sql in enumerate(migrations):
            try:
                print(f"执行迁移 {i+1}...")
                conn.execute(text(sql))
                conn.commit()
                print(f"迁移 {i+1} 成功")
            except Exception as e:
                if "Duplicate column" in str(e) or "Duplicate key" in str(e) or "already exists" in str(e):
                    print(f"迁移 {i+1} 跳过 (已存在)")
                else:
                    print(f"迁移 {i+1} 错误: {e}")

if __name__ == "__main__":
    run_migrations()
    print("迁移完成!")
