"""
Fix Passwords Script
Unify all test user passwords to '123456' for easier testing
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')

from app.database import SessionLocal
from app.models.user import User
from app.core.security import get_password_hash


def fix_passwords():
    """Update all test user passwords to 123456"""
    db = SessionLocal()

    try:
        # Get all users
        users = db.query(User).all()
        new_password_hash = get_password_hash("123456")

        print("Updating passwords for all users to '123456'...")
        for user in users:
            user.password = new_password_hash
            print(f"  Updated: {user.username} (id={user.id})")

        db.commit()
        print(f"\nUpdated {len(users)} users successfully!")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    fix_passwords()
