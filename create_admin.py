"""Create the first ADMIN account (run once on the server).

Usage:
    python create_admin.py "Srikar" 9876543210 123456

After this, log in as admin and create everything else through /admin/* endpoints.
"""
import sys
from database import Base, engine, SessionLocal
from models import User, Role
from security import hash_pin


def main():
    if len(sys.argv) != 4:
        print('Usage: python create_admin.py "<name>" <phone> <pin>')
        sys.exit(1)
    name, phone, pin = sys.argv[1:4]
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if db.query(User).filter(User.phone == phone).first():
        print("That phone is already registered.")
        sys.exit(1)
    db.add(User(name=name, phone=phone, pin_hash=hash_pin(pin), role=Role.ADMIN))
    db.commit()
    print(f"Admin '{name}' created.")


if __name__ == "__main__":
    main()
