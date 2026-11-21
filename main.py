from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session

from database import Base, engine, get_db
from models import Flat, User, VisitRequest, VisitStatus, Role
from schemas import (
    LoginIn, TokenOut, UserCreate, UserOut,
    VisitCreate, DecisionIn, VisitOut,
)
from security import (
    hash_pin, verify_pin, create_token,
    is_locked, record_failure, clear_failures,
)
from deps import current_user, require_role

Base.metadata.create_all(bind=engine)  # creates tables on first run

# Hide the interactive docs in production by setting DOCS=off
import os
_docs = os.getenv("DOCS", "on") != "off"
app = FastAPI(
    title="Apartment Gate Pass",
    docs_url="/docs" if _docs else None,
    redoc_url=None,
    openapi_url="/openapi.json" if _docs else None,
)

# Which web addresses may call this API from a browser (comma separated).
# Dev default is the Vite dev server. In production set CORS_ORIGINS to your real domain.
from fastapi.middleware.cors import CORSMiddleware
_origins = [
    o.strip()
    for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_methods=["GET", "POST", "PATCH"],
    allow_headers=["Authorization", "Content-Type"],
)

EXPIRY_MINUTES = 2


def expire_old(db: Session):
    """Mark PENDING requests older than 2 minutes as EXPIRED."""
    cutoff = datetime.utcnow() - timedelta(minutes=EXPIRY_MINUTES)
    db.query(VisitRequest).filter(
        VisitRequest.status == VisitStatus.PENDING,
        VisitRequest.created_at < cutoff,
    ).update({VisitRequest.status: VisitStatus.EXPIRED})
    db.commit()


# ------------------------------------------------------------------ auth
@app.post("/auth/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    if is_locked(body.phone):
        raise HTTPException(429, "Too many attempts. Try again in a few minutes.")
    user = db.query(User).filter(User.phone == body.phone).first()
    # Same error for "no such user" and "wrong PIN" so attackers can't probe numbers
    if not user or not user.is_active or not verify_pin(body.pin, user.pin_hash):
        record_failure(body.phone)
        raise HTTPException(401, "Invalid phone or PIN")
    clear_failures(body.phone)
    return TokenOut(
        access_token=create_token(user.id, user.role.value),
        role=user.role,
        name=user.name,
    )


@app.get("/auth/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


# ----------------------------------------------------------------- admin
@app.post("/admin/flats/{flat_no}", status_code=201)
def add_flat(
    flat_no: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    if db.query(Flat).filter(Flat.flat_no == flat_no).first():
        raise HTTPException(400, "Flat already exists")
    flat = Flat(flat_no=flat_no)
    db.add(flat)
    db.commit()
    return {"id": flat.id, "flat_no": flat.flat_no}


@app.post("/admin/users", response_model=UserOut, status_code=201)
def add_user(
    body: UserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    if db.query(User).filter(User.phone == body.phone).first():
        raise HTTPException(400, "Phone already registered")
    flat_id: Optional[int] = None
    if body.role == Role.RESIDENT:
        flat = db.query(Flat).filter(Flat.flat_no == body.flat_no).first()
        if not flat:
            raise HTTPException(404, "Flat not found (needed for a resident)")
        flat_id = flat.id
    user = User(
        name=body.name,
        phone=body.phone,
        pin_hash=hash_pin(body.pin),
        role=body.role,
        flat_id=flat_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/admin/users", response_model=List[UserOut])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.ADMIN)),
):
    return db.query(User).order_by(User.id).all()


@app.patch("/admin/users/{user_id}/disable", response_model=UserOut)
def disable_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_role(Role.ADMIN)),
):
    """Lost phone / fired watchman: cut access immediately."""
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.id == admin.id:
        raise HTTPException(400, "You cannot disable yourself")
    user.is_active = False
    db.commit()
    db.refresh(user)
    return user


# ---------------------------------------------------------------- visits
@app.post("/visits", response_model=VisitOut, status_code=201)
def create_visit(
    body: VisitCreate,
    db: Session = Depends(get_db),
    watchman: User = Depends(require_role(Role.WATCHMAN)),
):
    """Watchman creates a request for a guest."""
    flat = db.query(Flat).filter(Flat.flat_no == body.flat_no).first()
    if not flat:
        raise HTTPException(404, "Flat not found")
    visit = VisitRequest(
        guest_name=body.guest_name,
        guest_phone=body.guest_phone,
        flat_id=flat.id,
        purpose=body.purpose,
        requested_by=watchman.id,
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    # TODO: send FCM push to the flat's residents here
    return visit


@app.get("/flats", response_model=List[str])
def list_flats(
    db: Session = Depends(get_db),
    _: User = Depends(current_user),
):
    """Flat numbers for the watchman's dropdown (any logged-in user)."""
    return [f.flat_no for f in db.query(Flat).order_by(Flat.flat_no).all()]


@app.get("/visits/active", response_model=List[VisitOut])
def active_visits(
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.WATCHMAN)),
):
    """Watchman home: guests waiting for a reply, approved, or currently inside."""
    expire_old(db)
    return (
        db.query(VisitRequest)
        .filter(VisitRequest.status.in_(
            [VisitStatus.PENDING, VisitStatus.APPROVED, VisitStatus.CHECKED_IN]
        ))
        .order_by(VisitRequest.created_at.desc())
        .all()
    )


@app.get("/visits/pending", response_model=List[VisitOut])
def my_pending(
    db: Session = Depends(get_db),
    resident: User = Depends(require_role(Role.RESIDENT)),
):
    """Resident app: pending requests for MY flat only (flat comes from the token)."""
    expire_old(db)
    return (
        db.query(VisitRequest)
        .filter(
            VisitRequest.flat_id == resident.flat_id,
            VisitRequest.status == VisitStatus.PENDING,
        )
        .order_by(VisitRequest.created_at.desc())
        .all()
    )


@app.get("/visits/history", response_model=List[VisitOut])
def history(
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.RESIDENT, Role.ADMIN)),
):
    """Resident sees own flat's log; admin sees everything."""
    q = db.query(VisitRequest)
    if user.role == Role.RESIDENT:
        q = q.filter(VisitRequest.flat_id == user.flat_id)
    return q.order_by(VisitRequest.created_at.desc()).limit(100).all()


@app.get("/visits/{visit_id}", response_model=VisitOut)
def get_visit(
    visit_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(require_role(Role.WATCHMAN, Role.RESIDENT, Role.ADMIN)),
):
    """Watchman polls this to see approve/reject."""
    expire_old(db)
    visit = db.get(VisitRequest, visit_id)
    if not visit:
        raise HTTPException(404, "Visit not found")
    if user.role == Role.RESIDENT and visit.flat_id != user.flat_id:
        raise HTTPException(404, "Visit not found")  # 404, not 403: don't reveal it exists
    return visit


@app.patch("/visits/{visit_id}/decision", response_model=VisitOut)
def decide(
    visit_id: int,
    body: DecisionIn,
    db: Session = Depends(get_db),
    resident: User = Depends(require_role(Role.RESIDENT)),
):
    """Resident of that flat approves or rejects."""
    expire_old(db)
    visit = db.get(VisitRequest, visit_id)
    if not visit or visit.flat_id != resident.flat_id:
        raise HTTPException(404, "Visit not found")
    # Atomic: only one decision can win, even if two phones tap at the same moment
    updated = (
        db.query(VisitRequest)
        .filter(VisitRequest.id == visit_id, VisitRequest.status == VisitStatus.PENDING)
        .update({
            VisitRequest.status: VisitStatus(body.decision),
            VisitRequest.decided_by: resident.id,
            VisitRequest.decided_at: datetime.utcnow(),
        })
    )
    db.commit()
    if updated == 0:
        db.refresh(visit)
        raise HTTPException(400, f"Already {visit.status.value}")
    db.refresh(visit)
    return visit


@app.patch("/visits/{visit_id}/checkin", response_model=VisitOut)
def check_in(
    visit_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.WATCHMAN)),
):
    visit = db.get(VisitRequest, visit_id)
    if not visit:
        raise HTTPException(404, "Visit not found")
    if visit.status != VisitStatus.APPROVED:
        raise HTTPException(400, "Guest is not approved")
    visit.status = VisitStatus.CHECKED_IN
    visit.checkin_at = datetime.utcnow()
    db.commit()
    db.refresh(visit)
    return visit


@app.patch("/visits/{visit_id}/checkout", response_model=VisitOut)
def check_out(
    visit_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_role(Role.WATCHMAN)),
):
    visit = db.get(VisitRequest, visit_id)
    if not visit:
        raise HTTPException(404, "Visit not found")
    if visit.status != VisitStatus.CHECKED_IN:
        raise HTTPException(400, "Guest is not checked in")
    visit.status = VisitStatus.CHECKED_OUT
    visit.checkout_at = datetime.utcnow()
    db.commit()
    db.refresh(visit)
    return visit
