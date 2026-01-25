"""
Data Scope Migration Script
Add manager_id and data_scope fields to tn_users table
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app.database import engine, SessionLocal
from sqlalchemy import text

def migrate():
    """Add manager_id and data_scope fields"""
    db = SessionLocal()

    try:
        # Check if columns already exist
        result = db.execute(text("""
            SELECT COLUMN_NAME FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = 'wq' AND TABLE_NAME = 'tn_users'
            AND COLUMN_NAME IN ('manager_id', 'data_scope')
        """))
        existing_columns = [row[0] for row in result]

        # Add manager_id if not exists
        if 'manager_id' not in existing_columns:
            print("Adding manager_id column...")
            db.execute(text("""
                ALTER TABLE tn_users
                ADD COLUMN manager_id INT NULL COMMENT 'Direct manager ID'
            """))
            db.commit()
            print("  - manager_id added")
        else:
            print("  - manager_id already exists, skipping")

        # Add data_scope if not exists
        if 'data_scope' not in existing_columns:
            print("Adding data_scope column...")
            db.execute(text("""
                ALTER TABLE tn_users
                ADD COLUMN data_scope ENUM('self', 'team', 'all') DEFAULT 'self'
                COMMENT 'Data scope: self=own only, team=self+subordinates, all=all'
            """))
            db.commit()
            print("  - data_scope added")
        else:
            print("  - data_scope already exists, skipping")

        # Update existing tenant_admin users to have 'all' scope
        print("\nUpdating tenant_admin users to data_scope='all'...")
        result = db.execute(text("""
            UPDATE tn_users SET data_scope = 'all'
            WHERE role = 'tenant_admin' AND data_scope = 'self'
        """))
        db.commit()
        print(f"  - Updated {result.rowcount} users")

        print("\nMigration completed successfully!")

    except Exception as e:
        print(f"Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    migrate()
