"""
Create Test Customers Script
Creates customers assigned to different employees for testing data permissions
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app.database import SessionLocal
from app.models.user import User
from app.models import Customer, CustomerTemplate


def create_test_customers():
    """Create test customers for different employees"""
    db = SessionLocal()

    try:
        # Get test tenant
        tenant_id = 2  # Demo tenant

        # Get users
        users = db.query(User).filter(User.tenant_id == tenant_id).all()
        user_map = {u.username: u for u in users}

        print(f"Found {len(users)} users in tenant {tenant_id}")
        for u in users:
            print(f"  - {u.username} (id={u.id}, data_scope={u.data_scope})")

        # Get default template
        template = db.query(CustomerTemplate).filter(
            CustomerTemplate.tenant_id == None  # System template
        ).first()

        if not template:
            template = db.query(CustomerTemplate).first()

        if not template:
            print("No template found. Please create a template first.")
            return

        print(f"\nUsing template: {template.name} (id={template.id})")

        # Test customers to create
        test_customers = [
            {"name": "Admin's Customer A", "managed_by": "demoadmin"},
            {"name": "Admin's Customer B", "managed_by": "demoadmin"},
            {"name": "Manager1's Customer A", "managed_by": "manager1"},
            {"name": "Manager1's Customer B", "managed_by": "manager1"},
            {"name": "Employee1's Customer A", "managed_by": "employee1"},
            {"name": "Employee1's Customer B", "managed_by": "employee1"},
            {"name": "Employee2's Customer A", "managed_by": "employee2"},
            {"name": "Employee2's Customer B", "managed_by": "employee2"},
            {"name": "Employee3's Customer A", "managed_by": "employee3"},
        ]

        print(f"\nCreating {len(test_customers)} test customers...")

        for cust_data in test_customers:
            user = user_map.get(cust_data["managed_by"])
            if not user:
                print(f"  User {cust_data['managed_by']} not found, skipping {cust_data['name']}")
                continue

            # Check if customer already exists
            existing = db.query(Customer).filter(
                Customer.name == cust_data["name"],
                Customer.tenant_id == tenant_id
            ).first()

            if existing:
                print(f"  {cust_data['name']} already exists, skipping")
                continue

            customer = Customer(
                name=cust_data["name"],
                managed_by=user.id,
                template_id=template.id,
                tenant_id=tenant_id
            )
            db.add(customer)
            print(f"  Created: {cust_data['name']} -> {cust_data['managed_by']}")

        db.commit()

        print("\n" + "=" * 60)
        print("Test customers created!")
        print("=" * 60)

        # Summary
        print("\nExpected visibility:")
        print("-" * 60)
        print("demoadmin (all): All 9 customers")
        print("manager1 (team): manager1's 2 + employee1's 2 + employee2's 2 = 6 customers")
        print("employee1 (self): 2 customers")
        print("employee2 (self): 2 customers")
        print("employee3 (all): All 9 customers")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_test_customers()
