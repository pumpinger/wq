"""SaaS多租户迁移脚本"""
from sqlalchemy import text
from app.database import engine
from app.core.security import get_password_hash

# 迁移SQL列表
migrations = [
    # 1. 创建租户表
    """
    CREATE TABLE IF NOT EXISTS tn_tenants (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100) NOT NULL COMMENT '租户名称',
        code VARCHAR(50) NOT NULL UNIQUE COMMENT '租户编码',
        status ENUM('active', 'inactive', 'suspended') DEFAULT 'active' COMMENT '状态',
        max_users INT DEFAULT 10 COMMENT '最大用户数',
        expires_at DATE NULL COMMENT '到期时间',
        contact_name VARCHAR(50) NULL COMMENT '联系人',
        contact_phone VARCHAR(20) NULL COMMENT '联系电话',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='租户表'
    """,

    # 2. 修改用户表 - 添加 tenant_id
    """
    ALTER TABLE tn_users ADD COLUMN tenant_id INT NULL COMMENT '所属租户'
    """,

    # 3. 修改用户表 - 添加 email
    """
    ALTER TABLE tn_users ADD COLUMN email VARCHAR(100) NULL COMMENT '邮箱'
    """,

    # 4. 修改用户表 - 添加 phone
    """
    ALTER TABLE tn_users ADD COLUMN phone VARCHAR(20) NULL COMMENT '手机号'
    """,

    # 5. 修改用户表 - 添加 real_name
    """
    ALTER TABLE tn_users ADD COLUMN real_name VARCHAR(50) NULL COMMENT '真实姓名'
    """,

    # 6. 修改用户表 - 添加 status
    """
    ALTER TABLE tn_users ADD COLUMN status ENUM('active', 'inactive') DEFAULT 'active' COMMENT '状态'
    """,

    # 7. 修改用户表 - 添加 is_super_admin
    """
    ALTER TABLE tn_users ADD COLUMN is_super_admin BOOLEAN DEFAULT FALSE COMMENT '是否超级管理员'
    """,

    # 8. 添加租户外键
    """
    ALTER TABLE tn_users ADD CONSTRAINT fk_user_tenant
    FOREIGN KEY (tenant_id) REFERENCES tn_tenants(id) ON DELETE SET NULL
    """,

    # 9. 创建角色表
    """
    CREATE TABLE IF NOT EXISTS tn_roles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        tenant_id INT NULL COMMENT '所属租户，NULL表示系统角色',
        name VARCHAR(50) NOT NULL COMMENT '角色名称',
        code VARCHAR(50) NOT NULL COMMENT '角色编码',
        description VARCHAR(255) NULL COMMENT '描述',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_tenant_code (tenant_id, code),
        FOREIGN KEY (tenant_id) REFERENCES tn_tenants(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表'
    """,

    # 10. 创建权限表
    """
    CREATE TABLE IF NOT EXISTS tn_permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        code VARCHAR(100) NOT NULL UNIQUE COMMENT '权限编码',
        name VARCHAR(100) NOT NULL COMMENT '权限名称',
        module VARCHAR(50) NULL COMMENT '所属模块',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限表'
    """,

    # 11. 创建用户角色关联表
    """
    CREATE TABLE IF NOT EXISTS tn_user_roles (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id INT NOT NULL,
        role_id INT NOT NULL,
        UNIQUE KEY uk_user_role (user_id, role_id),
        FOREIGN KEY (user_id) REFERENCES tn_users(id) ON DELETE CASCADE,
        FOREIGN KEY (role_id) REFERENCES tn_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表'
    """,

    # 12. 创建角色权限关联表
    """
    CREATE TABLE IF NOT EXISTS tn_role_permissions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        role_id INT NOT NULL,
        permission_id INT NOT NULL,
        UNIQUE KEY uk_role_permission (role_id, permission_id),
        FOREIGN KEY (role_id) REFERENCES tn_roles(id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES tn_permissions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色权限关联表'
    """,

    # 13. 客户表添加 tenant_id
    """
    ALTER TABLE tn_customers ADD COLUMN tenant_id INT NULL COMMENT '所属租户'
    """,

    # 14. 模板表添加 tenant_id
    """
    ALTER TABLE tn_customer_templates ADD COLUMN tenant_id INT NULL COMMENT '所属租户'
    """,

    # 15. 字段定义表添加 tenant_id
    """
    ALTER TABLE tn_field_definitions ADD COLUMN tenant_id INT NULL COMMENT '所属租户，NULL表示系统字段'
    """,
]

# 初始化数据SQL
init_data = [
    # 初始化权限
    """
    INSERT IGNORE INTO tn_permissions (code, name, module) VALUES
    ('tenant:view', '查看租户', '租户管理'),
    ('tenant:create', '创建租户', '租户管理'),
    ('tenant:update', '更新租户', '租户管理'),
    ('tenant:delete', '删除租户', '租户管理'),
    ('user:view', '查看用户', '用户管理'),
    ('user:create', '创建用户', '用户管理'),
    ('user:update', '更新用户', '用户管理'),
    ('user:delete', '删除用户', '用户管理'),
    ('customer:view', '查看客户', '客户管理'),
    ('customer:create', '创建客户', '客户管理'),
    ('customer:update', '更新客户', '客户管理'),
    ('customer:delete', '删除客户', '客户管理'),
    ('customer:view_all', '查看所有客户', '客户管理'),
    ('template:view', '查看模板', '模板管理'),
    ('template:create', '创建模板', '模板管理'),
    ('template:update', '更新模板', '模板管理'),
    ('template:delete', '删除模板', '模板管理'),
    ('field:view', '查看字段', '字段管理'),
    ('field:create', '创建字段', '字段管理'),
    ('field:update', '更新字段', '字段管理'),
    ('field:delete', '删除字段', '字段管理')
    """,

    # 初始化系统角色
    """
    INSERT IGNORE INTO tn_roles (tenant_id, name, code, description) VALUES
    (NULL, '租户管理员', 'tenant_admin', '租户的管理员，拥有租户内所有权限'),
    (NULL, '普通员工', 'user', '普通员工，只能管理自己的客户')
    """,
]


def run_migrations():
    """执行迁移"""
    with engine.connect() as conn:
        for i, sql in enumerate(migrations):
            try:
                print(f"Migration {i+1}/{len(migrations)}...")
                conn.execute(text(sql))
                conn.commit()
                print(f"  [OK]")
            except Exception as e:
                error_msg = str(e).lower()
                if "duplicate" in error_msg or "already exists" in error_msg or "1060" in str(e):
                    print(f"  [SKIP] Already exists")
                else:
                    print(f"  [ERROR] {e}")


def init_data_sql():
    """初始化数据"""
    with engine.connect() as conn:
        for i, sql in enumerate(init_data):
            try:
                print(f"Init data {i+1}/{len(init_data)}...")
                conn.execute(text(sql))
                conn.commit()
                print(f"  [OK]")
            except Exception as e:
                error_msg = str(e).lower()
                if "duplicate" in error_msg:
                    print(f"  [SKIP] Already exists")
                else:
                    print(f"  [ERROR] {e}")


def create_super_admin():
    """创建超级管理员账号"""
    password_hash = get_password_hash("admin123")

    with engine.connect() as conn:
        # 检查是否已存在超级管理员
        result = conn.execute(text("SELECT id FROM tn_users WHERE is_super_admin = 1 LIMIT 1"))
        if result.fetchone():
            print("Super admin already exists, skip")
            return

        try:
            conn.execute(text("""
                INSERT INTO tn_users (username, password, real_name, role, status, is_super_admin)
                VALUES (:username, :password, :real_name, :role, :status, :is_super_admin)
            """), {
                "username": "superadmin",
                "password": password_hash,
                "real_name": "Super Admin",
                "role": "super_admin",
                "status": "active",
                "is_super_admin": True
            })
            conn.commit()
            print("[OK] Super admin created")
            print("  Username: superadmin")
            print("  Password: admin123")
            print("  Please change password after login!")
        except Exception as e:
            print(f"[ERROR] Create super admin failed: {e}")


if __name__ == "__main__":
    print("=" * 50)
    print("SaaS Multi-tenant Migration Script")
    print("=" * 50)

    print("\n[1/3] Running database migrations...")
    run_migrations()

    print("\n[2/3] Initializing base data...")
    init_data_sql()

    print("\n[3/3] Creating super admin...")
    create_super_admin()

    print("\n" + "=" * 50)
    print("Migration completed!")
    print("=" * 50)
