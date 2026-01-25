"""
Fix Duplicate Username Script
Rename duplicate employee1 to avoid login ambiguity
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app.database import SessionLocal
from app.models.user import User


def fix_duplicate():
    """Rename duplicate employee1 in Demo tenant"""
    db = SessionLocal()

    try:
        # Find employee1 in Demo tenant (id=7, tenant_id=2)
        user = db.query(User).filter(User.id == 7).first()
        if user and user.username == "employee1":
            old_name = user.username
            user.username = "demo_emp1"
            user.real_name = "Demo Employee 1"
            db.commit()
            print(f"Renamed user id=7: {old_name} -> demo_emp1")
        else:
            print(f"User id=7 not found or already renamed: {user.username if user else 'N/A'}")

        # Verify no duplicates remain
        duplicates = db.query(User.username).group_by(User.username).having(
            db.query(User).filter(User.username == User.username).count() > 1
        ).all()

        # Simple duplicate check
        all_users = db.query(User).all()
        username_count = {}
        for u in all_users:
            username_count[u.username] = username_count.get(u.username, 0) + 1

        dups = {k: v for k, v in username_count.items() if v > 1}
        if dups:
            print(f"\nWarning: Still have duplicate usernames: {dups}")
        else:
            print("\nNo duplicate usernames found.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    fix_duplicate()
