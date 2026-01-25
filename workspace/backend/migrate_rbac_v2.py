"""
RBAC v2 Migration Script
Move data_scope from role level to permission level
Each role-permission can have its own data_scope
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app.database import SessionLocal
from sqlalchemy import text


def migrate():
    """Migrate to RBAC v2 with per-permission data scope"""
    db = SessionLocal()

    try:
        print("=" * 60)
        print("RBAC v2 Migration - Per-Permission Data Scope")
        print("=" * 60)

        # 1. Add data_scope column to tn_role_permissions
        print("\n1. Adding data_scope to tn_role_permissions...")
        try:
            db.execute(text("""
                ALTER TABLE tn_role_permissions
                ADD COLUMN data_scope ENUM('self', 'team', 'all') DEFAULT 'self'
                COMMENT '此权限的数据范围'
            """))
            db.commit()
            print("   Added data_scope column.")
        except Exception as e:
            if "Duplicate column" in str(e):
                print("   Column already exists, skipping.")
            else:
                raise

        # 2. Migrate existing data - copy role's data_scope to all its permissions
        print("\n2. Migrating existing role data_scope to permissions...")
        db.execute(text("""
            UPDATE tn_role_permissions rp
            JOIN tn_roles r ON rp.role_id = r.id
            SET rp.data_scope = r.data_scope
        """))
        db.commit()
        print("   Done.")

        # 3. Update system roles with more granular permissions
        print("\n3. Setting up granular permissions for system roles...")

        # Get role and permission IDs
        roles_result = db.execute(text("SELECT id, code FROM tn_roles WHERE is_system = TRUE"))
        roles = {row[1]: row[0] for row in roles_result}

        perms_result = db.execute(text("SELECT id, module, action FROM tn_permissions"))
        perms = {f"{row[1]}:{row[2]}": row[0] for row in perms_result}

        # Manager role: different scopes for different actions
        manager_role_id = roles.get('manager')
        if manager_role_id:
            # View customers: team scope
            db.execute(text("""
                UPDATE tn_role_permissions
                SET data_scope = 'team'
                WHERE role_id = :role_id AND permission_id = :perm_id
            """), {"role_id": manager_role_id, "perm_id": perms.get('customer:view')})

            # Create customers: self (creates for self)
            db.execute(text("""
                UPDATE tn_role_permissions
                SET data_scope = 'self'
                WHERE role_id = :role_id AND permission_id = :perm_id
            """), {"role_id": manager_role_id, "perm_id": perms.get('customer:create')})

            # Edit customers: team scope
            db.execute(text("""
                UPDATE tn_role_permissions
                SET data_scope = 'team'
                WHERE role_id = :role_id AND permission_id = :perm_id
            """), {"role_id": manager_role_id, "perm_id": perms.get('customer:edit')})

            # Delete customers: self only (can only delete own)
            db.execute(text("""
                UPDATE tn_role_permissions
                SET data_scope = 'self'
                WHERE role_id = :role_id AND permission_id = :perm_id
            """), {"role_id": manager_role_id, "perm_id": perms.get('customer:delete')})

            # Transfer customers: team scope
            db.execute(text("""
                UPDATE tn_role_permissions
                SET data_scope = 'team'
                WHERE role_id = :role_id AND permission_id = :perm_id
            """), {"role_id": manager_role_id, "perm_id": perms.get('customer:transfer')})

            # View users: team scope
            db.execute(text("""
                UPDATE tn_role_permissions
                SET data_scope = 'team'
                WHERE role_id = :role_id AND permission_id = :perm_id
            """), {"role_id": manager_role_id, "perm_id": perms.get('user:view')})

        db.commit()
        print("   Updated manager role with granular permissions.")

        # 4. Verify the migration
        print("\n4. Verifying migration...")

        # Show manager role permissions with scopes
        result = db.execute(text("""
            SELECT p.module, p.action, p.name, rp.data_scope
            FROM tn_role_permissions rp
            JOIN tn_permissions p ON rp.permission_id = p.id
            JOIN tn_roles r ON rp.role_id = r.id
            WHERE r.code = 'manager'
            ORDER BY p.module, p.action
        """))

        print("\n   Manager role permissions:")
        for row in result:
            scope_text = {'self': '仅自己', 'team': '团队', 'all': '全部'}[row[3]]
            print(f"   - {row[2]} ({row[0]}:{row[1]}): {scope_text}")

        print("\n" + "=" * 60)
        print("RBAC v2 Migration completed successfully!")
        print("=" * 60)

    except Exception as e:
        print(f"\nError: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
