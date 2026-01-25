"""
Create Test Employees Script
Creates employees with different data_scope permissions for testing
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash
from sqlalchemy import text


def create_test_employees():
    """Create test employees with different permissions"""
    db = SessionLocal()

    try:
        # Get test tenant (assuming tenant_id=1 exists)
        result = db.execute(text("SELECT id FROM tn_tenants LIMIT 1"))
        row = result.fetchone()
        if not row:
            print("No tenant found. Please create a tenant first.")
            return
        tenant_id = row[0]
        print(f"Using tenant_id: {tenant_id}")

        # Find or create tenant_admin as the top of hierarchy
        admin = db.query(User).filter(
            User.tenant_id == tenant_id,
            User.role == 'tenant_admin'
        ).first()

        if not admin:
            print("No tenant_admin found. Creating one...")
            admin = User(
                username="testadmin",
                password=get_password_hash("123456"),
                real_name="Test Admin",
                role="tenant_admin",
                data_scope="all",
                tenant_id=tenant_id,
                status="active"
            )
            db.add(admin)
            db.flush()
            print(f"  Created testadmin (id={admin.id})")
        else:
            print(f"  Found existing admin: {admin.username} (id={admin.id})")
            # Update admin to have 'all' scope
            admin.data_scope = 'all'
            db.flush()

        admin_id = admin.id

        # Test employees to create
        test_employees = [
            {
                "username": "manager1",
                "real_name": "Manager A",
                "role": "user",
                "data_scope": "team",
                "manager_id": admin_id,
            },
            {
                "username": "employee1",
                "real_name": "Employee 1",
                "role": "user",
                "data_scope": "self",
                "manager_id": None,  # Will be set to manager1's id
            },
            {
                "username": "employee2",
                "real_name": "Employee 2",
                "role": "user",
                "data_scope": "self",
                "manager_id": None,  # Will be set to manager1's id
            },
            {
                "username": "employee3",
                "real_name": "Employee 3",
                "role": "user",
                "data_scope": "all",
                "manager_id": admin_id,
            },
        ]

        created_users = {}
        for emp_data in test_employees:
            existing = db.query(User).filter(
                User.username == emp_data["username"],
                User.tenant_id == tenant_id
            ).first()

            if existing:
                print(f"  {emp_data['username']} already exists (id={existing.id}), updating...")
                existing.real_name = emp_data["real_name"]
                existing.role = emp_data["role"]
                existing.data_scope = emp_data["data_scope"]
                if emp_data["manager_id"]:
                    existing.manager_id = emp_data["manager_id"]
                created_users[emp_data["username"]] = existing
            else:
                user = User(
                    username=emp_data["username"],
                    password=get_password_hash("123456"),
                    real_name=emp_data["real_name"],
                    role=emp_data["role"],
                    data_scope=emp_data["data_scope"],
                    manager_id=emp_data["manager_id"],
                    tenant_id=tenant_id,
                    status="active"
                )
                db.add(user)
                db.flush()
                created_users[emp_data["username"]] = user
                print(f"  Created {emp_data['username']} (id={user.id})")

        # Set manager1 as manager for employee1 and employee2
        manager1 = created_users.get("manager1")
        if manager1:
            for emp_name in ["employee1", "employee2"]:
                emp = created_users.get(emp_name)
                if emp:
                    emp.manager_id = manager1.id
                    print(f"  Set {emp_name}'s manager to manager1 (id={manager1.id})")

        db.commit()

        print("\n" + "=" * 60)
        print("Test employees created successfully!")
        print("=" * 60)
        print("\nTest account credentials (password: 123456):")
        print("-" * 60)
        print(f"{'Username':<15} {'Name':<15} {'Role':<15} {'Data Scope':<10} {'Manager'}")
        print("-" * 60)
        print(f"{admin.username:<15} {admin.real_name:<15} {admin.role:<15} {'all':<10} -")
        for emp_data in test_employees:
            user = created_users.get(emp_data["username"])
            if user:
                manager_name = "-"
                if user.manager_id:
                    manager = db.query(User).filter(User.id == user.manager_id).first()
                    manager_name = manager.username if manager else "-"
                print(f"{user.username:<15} {user.real_name:<15} {user.role:<15} {user.data_scope or 'self':<10} {manager_name}")

        print("\nExpected data visibility:")
        print("-" * 60)
        print(f"- {admin.username}: See ALL customers in tenant")
        print(f"- manager1: See own + employee1 + employee2's customers")
        print(f"- employee1: See ONLY own customers")
        print(f"- employee2: See ONLY own customers")
        print(f"- employee3: See ALL customers in tenant")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_test_employees()
