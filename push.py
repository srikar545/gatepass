"""Push notifications through Firebase Cloud Messaging (FCM).

Server setup (never put this file in git):
    FIREBASE_CREDENTIALS=C:\\path\\to\\service-account.json

If FIREBASE_CREDENTIALS is not set, push is simply switched off and everything
else keeps working (the app still checks the server every few seconds).

We send "data-only" messages. The service worker in the frontend turns them into
the notification, so we control the text and what happens on tap.
"""
import logging
import os
from typing import Dict, List

from database import SessionLocal
from models import Role, User, VisitRequest

log = logging.getLogger("gatepass.push")

_ready = None  # None = not tried yet, True = working, False = off


def _init() -> bool:
    global _ready
    if _ready is not None:
        return _ready
    path = os.getenv("FIREBASE_CREDENTIALS")
    if not path:
        log.info("Push is off: FIREBASE_CREDENTIALS is not set")
        _ready = False
        return False
    try:
        import firebase_admin
        from firebase_admin import credentials

        firebase_admin.initialize_app(credentials.Certificate(path))
        _ready = True
    except Exception as e:  # missing file, bad JSON, package not installed...
        log.error("Push is off: could not start Firebase: %s", e)
        _ready = False
    return _ready


def send_to_tokens(tokens: List[str], title: str, body: str, data: Dict[str, str]) -> List[str]:
    """Send one message to each device token. Returns the tokens that are dead."""
    if not tokens or not _init():
        return []
    from firebase_admin import exceptions, messaging

    dead: List[str] = []
    for token in tokens:
        message = messaging.Message(
            token=token,
            data={**data, "title": title, "body": body},
            webpush=messaging.WebpushConfig(headers={"Urgency": "high", "TTL": "120"}),
        )
        try:
            messaging.send(message)
        except (
            messaging.UnregisteredError,
            messaging.SenderIdMismatchError,
            exceptions.InvalidArgumentError,
        ):
            dead.append(token)  # app uninstalled / token expired
        except Exception as e:
            log.warning("Push failed for one device: %s", e)
    return dead


def _forget(db, dead: List[str]) -> None:
    for token in dead:
        db.query(User).filter(User.fcm_token == token).update({User.fcm_token: None})
    if dead:
        db.commit()


# These two run as background tasks, after the HTTP response is already sent.
# They open their own database session because the request's session is closed by then.
def notify_residents_of_request(visit_id: int) -> None:
    db = SessionLocal()
    try:
        visit = db.get(VisitRequest, visit_id)
        if not visit:
            return
        residents = (
            db.query(User)
            .filter(
                User.role == Role.RESIDENT,
                User.flat_id == visit.flat_id,
                User.is_active.is_(True),
                User.fcm_token.isnot(None),
            )
            .all()
        )
        what = f" ({visit.purpose})" if visit.purpose else ""
        dead = send_to_tokens(
            [u.fcm_token for u in residents],
            "Visitor at the gate",
            f"{visit.guest_name}{what} is waiting for approval",
            {"type": "visit_request", "visit_id": str(visit.id)},
        )
        _forget(db, dead)
    except Exception as e:
        log.warning("notify_residents_of_request failed: %s", e)
    finally:
        db.close()


def notify_watchman_of_decision(visit_id: int) -> None:
    db = SessionLocal()
    try:
        visit = db.get(VisitRequest, visit_id)
        if not visit or not visit.requested_by:
            return
        watchman = db.get(User, visit.requested_by)
        if not watchman or not watchman.is_active or not watchman.fcm_token:
            return
        verdict = "APPROVED, let them in" if visit.status.value == "APPROVED" else "REJECTED, do not let in"
        dead = send_to_tokens(
            [watchman.fcm_token],
            f"Flat {visit.flat_no}: {verdict}",
            visit.guest_name,
            {"type": "visit_decision", "visit_id": str(visit.id)},
        )
        _forget(db, dead)
    except Exception as e:
        log.warning("notify_watchman_of_decision failed: %s", e)
    finally:
        db.close()
