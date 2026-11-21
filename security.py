"""Password/PIN hashing, JWT tokens and login-attempt lockout.

Secrets come from environment variables. Never hard-code them.
  export JWT_SECRET="a-long-random-string"      # required in production
"""
import os
import hmac
import hashlib
import secrets
import time
from datetime import datetime, timedelta
from typing import Dict, List

import jwt

JWT_SECRET = os.getenv("JWT_SECRET", "dev-only-secret-do-not-use-in-production-0000")
if os.getenv("ENV") == "production" and "JWT_SECRET" not in os.environ:
    raise RuntimeError("Set JWT_SECRET before running in production")
JWT_ALGO = "HS256"
TOKEN_HOURS = int(os.getenv("TOKEN_HOURS", "12"))

# Login lockout: 5 wrong attempts within 5 minutes -> locked for 5 minutes
MAX_ATTEMPTS = 5
WINDOW_SECONDS = 300


# ---------- PIN hashing (PBKDF2, no extra dependency) ----------
def hash_pin(pin: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), 200_000)
    return f"{salt}${digest.hex()}"


def verify_pin(pin: str, stored: str) -> bool:
    try:
        salt, digest = stored.split("$")
    except ValueError:
        return False
    check = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), 200_000)
    return hmac.compare_digest(check.hex(), digest)


# ---------- JWT ----------
def create_token(user_id: int, role: str) -> str:
    payload = {
        "sub": str(user_id),
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])


# ---------- Login lockout (in-memory; fine for a single server) ----------
_failed: Dict[str, List[float]] = {}


def is_locked(key: str) -> bool:
    now = time.time()
    attempts = [t for t in _failed.get(key, []) if now - t < WINDOW_SECONDS]
    _failed[key] = attempts
    return len(attempts) >= MAX_ATTEMPTS


def record_failure(key: str) -> None:
    _failed.setdefault(key, []).append(time.time())


def clear_failures(key: str) -> None:
    _failed.pop(key, None)
