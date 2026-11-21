import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Enum, Boolean
from sqlalchemy.orm import relationship
from database import Base


class Role(str, enum.Enum):
    RESIDENT = "RESIDENT"
    WATCHMAN = "WATCHMAN"
    ADMIN = "ADMIN"


class VisitStatus(str, enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    CHECKED_IN = "CHECKED_IN"
    CHECKED_OUT = "CHECKED_OUT"


class Flat(Base):
    __tablename__ = "flats"
    id = Column(Integer, primary_key=True, index=True)
    flat_no = Column(String(10), unique=True, nullable=False)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    phone = Column(String(15), unique=True, nullable=False)
    pin_hash = Column(String(200), nullable=False)
    role = Column(Enum(Role), nullable=False)
    flat_id = Column(Integer, ForeignKey("flats.id"), nullable=True)  # null for watchman/admin
    is_active = Column(Boolean, default=True, nullable=False)
    fcm_token = Column(String(255), nullable=True)  # for push notifications later

    flat = relationship("Flat")

    @property
    def flat_no(self):
        return self.flat.flat_no if self.flat else None


class VisitRequest(Base):
    __tablename__ = "visit_requests"
    id = Column(Integer, primary_key=True, index=True)
    guest_name = Column(String(100), nullable=False)
    guest_phone = Column(String(15), nullable=False)
    flat_id = Column(Integer, ForeignKey("flats.id"), nullable=False)
    purpose = Column(String(200), nullable=True)
    status = Column(Enum(VisitStatus), default=VisitStatus.PENDING, nullable=False)
    requested_by = Column(Integer, ForeignKey("users.id"), nullable=True)  # watchman
    decided_by = Column(Integer, ForeignKey("users.id"), nullable=True)    # resident
    created_at = Column(DateTime, default=datetime.utcnow)
    decided_at = Column(DateTime, nullable=True)
    checkin_at = Column(DateTime, nullable=True)
    checkout_at = Column(DateTime, nullable=True)

    flat = relationship("Flat")

    @property
    def flat_no(self):
        return self.flat.flat_no if self.flat else None
