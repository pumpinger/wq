"""
RBAC Migration Script
Create roles, permissions, and related tables
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app.database import SessionLocal
from sqlalchemy import text


def migrate():
    """Create RBAC tables and initialize data"""
    db = SessionLocal()

    try:
        print("=" * 60)
        print("RBAC Migration")
        print("=" * 60)

        # 0. Drop existing tables if they exist (in reverse order of dependencies)
        print("\n0. Dropping existing RBAC tables...")
        db.execute(text("DROP TABLE IF EXISTS tn_user_roles"))
        db.execute(text("DROP TABLE IF EXISTS tn_role_permissions"))
        db.execute(text("DROP TABLE IF EXISTS tn_roles"))
        db.execute(text("DROP TABLE IF EXISTS tn_permissions"))
        db.commit()
        print("   Done.")

        # 1. Create tn_permissions table
        print("\n1. Creating tn_permissions table...")
        db.execute(text("""
            CREATE TABLE tn_permissions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                module VARCHAR(50) NOT NULL COMMENT '模块',
                action VARCHAR(50) NOT NULL COMMENT '操作',
                name VARCHAR(100) NOT NULL COMMENT '权限名称',
                description VARCHAR(200) COMMENT '权限描述',
                UNIQUE KEY uk_module_action (module, action)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='权限表'
        """))
        db.commit()
        print("   Done.")

        # 2. Create tn_roles table
        print("\n2. Creating tn_roles table...")
        db.execute(text("""
            CREATE TABLE tn_roles (
                id INT PRIMARY KEY AUTO_INCREMENT,
                tenant_id INT NULL COMMENT '所属租户，NULL为系统预置',
                name VARCHAR(50) NOT NULL COMMENT '角色名称',
                code VARCHAR(50) NOT NULL COMMENT '角色编码',
                description VARCHAR(200) COMMENT '角色描述',
                is_system BOOLEAN DEFAULT FALSE COMMENT '是否系统预置',
                data_scope ENUM('self', 'team', 'all') DEFAULT 'self' COMMENT '数据范围',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uk_tenant_code (tenant_id, code),
                FOREIGN KEY (tenant_id) REFERENCES tn_tenants(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色表'
        """))
        db.commit()
        print("   Done.")

        # 3. Create tn_role_permissions table
        print("\n3. Creating tn_role_permissions table...")
        db.execute(text("""
            CREATE TABLE tn_role_permissions (
                id INT PRIMARY KEY AUTO_INCREMENT,
                role_id INT NOT NULL,
                permission_id INT NOT NULL,
                UNIQUE KEY uk_role_permission (role_id, permission_id),
                FOREIGN KEY (role_id) REFERENCES tn_roles(id) ON DELETE CASCADE,
                FOREIGN KEY (permission_id) REFERENCES tn_permissions(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='角色权限关联表'
        """))
        db.commit()
        print("   Done.")

        # 4. Create tn_user_roles table
        print("\n4. Creating tn_user_roles table...")
        db.execute(text("""
            CREATE TABLE tn_user_roles (
                id INT PRIMARY KEY AUTO_INCREMENT,
                user_id INT NOT NULL,
                role_id INT NOT NULL,
                UNIQUE KEY uk_user_role (user_id, role_id),
                FOREIGN KEY (user_id) REFERENCES tn_users(id) ON DELETE CASCADE,
                FOREIGN KEY (role_id) REFERENCES tn_roles(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户角色关联表'
        """))
        db.commit()
        print("   Done.")

        # 5. Initialize permissions
        print("\n5. Initializing permissions...")
        permissions = [
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

        for module, action, name, desc in permissions:
            db.execute(text("""
                INSERT INTO tn_permissions (module, action, name, description)
                VALUES (:module, :action, :name, :desc)
            """), {"module": module, "action": action, "name": name, "desc": desc})

        db.commit()
        print(f"   Initialized {len(permissions)} permissions.")

        # 6. Initialize system roles
        print("\n6. Initializing system roles...")
        system_roles = [
            ('tenant_admin', '租户管理员', '拥有租户内所有权限', 'all'),
            ('manager', '部门经理', '管理团队客户，查看员工', 'team'),
            ('sales', '销售员', '管理自己的客户', 'self'),
        ]

        for code, name, desc, scope in system_roles:
            db.execute(text("""
                INSERT INTO tn_roles (tenant_id, name, code, description, is_system, data_scope)
                VALUES (NULL, :name, :code, :desc, TRUE, :scope)
            """), {"name": name, "code": code, "desc": desc, "scope": scope})

        db.commit()
        print(f"   Initialized {len(system_roles)} system roles.")

        # 7. Assign permissions to roles
        print("\n7. Assigning permissions to roles...")

        # Get role IDs
        roles_result = db.execute(text("SELECT id, code FROM tn_roles WHERE is_system = TRUE"))
        roles = {row[1]: row[0] for row in roles_result}

        # Get permission IDs
        perms_result = db.execute(text("SELECT id, module, action FROM tn_permissions"))
        perms = {f"{row[1]}:{row[2]}": row[0] for row in perms_result}

        # Role permission mapping
        role_perms = {
            'tenant_admin': list(perms.keys()),  # All permissions
            'manager': [
                'customer:view', 'customer:create', 'customer:edit', 'customer:delete', 'customer:transfer',
                'template:view', 'field:view', 'user:view'
            ],
            'sales': [
                'customer:view', 'customer:create', 'customer:edit',
                'template:view', 'field:view'
            ],
        }

        for role_code, perm_codes in role_perms.items():
            role_id = roles.get(role_code)
            if not role_id:
                continue
            for perm_code in perm_codes:
                perm_id = perms.get(perm_code)
                if perm_id:
                    db.execute(text("""
                        INSERT INTO tn_role_permissions (role_id, permission_id)
                        VALUES (:role_id, :perm_id)
                    """), {"role_id": role_id, "perm_id": perm_id})

        db.commit()
        print("   Done.")

        # 8. Migrate existing users to roles
        print("\n8. Migrating existing users to roles...")

        # tenant_admin users -> tenant_admin role
        admin_role_id = roles.get('tenant_admin')
        if admin_role_id:
            result = db.execute(text("""
                INSERT IGNORE INTO tn_user_roles (user_id, role_id)
                SELECT id, :role_id FROM tn_users
                WHERE role = 'tenant_admin' AND is_super_admin = FALSE
            """), {"role_id": admin_role_id})
            db.commit()
            print(f"   Migrated tenant_admin users.")

        # regular users -> sales role
        sales_role_id = roles.get('sales')
        if sales_role_id:
            result = db.execute(text("""
                INSERT IGNORE INTO tn_user_roles (user_id, role_id)
                SELECT id, :role_id FROM tn_users
                WHERE role = 'user' AND is_super_admin = FALSE
            """), {"role_id": sales_role_id})
            db.commit()
            print(f"   Migrated regular users to sales role.")

        print("\n" + "=" * 60)
        print("RBAC Migration completed successfully!")
        print("=" * 60)

        # Summary
        print("\nSummary:")
        count = db.execute(text("SELECT COUNT(*) FROM tn_permissions")).scalar()
        print(f"  - Permissions: {count}")
        count = db.execute(text("SELECT COUNT(*) FROM tn_roles")).scalar()
        print(f"  - Roles: {count}")
        count = db.execute(text("SELECT COUNT(*) FROM tn_role_permissions")).scalar()
        print(f"  - Role-Permission mappings: {count}")
        count = db.execute(text("SELECT COUNT(*) FROM tn_user_roles")).scalar()
        print(f"  - User-Role mappings: {count}")

    except Exception as e:
        print(f"\nError: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
