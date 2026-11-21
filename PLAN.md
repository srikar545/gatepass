# Apartment Visitor Approval App: Start to End Plan

Goal: watchman enters guest details -> resident gets notified in the app -> resident approves/rejects -> watchman sees the result and lets the guest in (or not).

Scale: 1 apartment, 15 flats, 1-3 watchmen, ~15-40 resident phones.

---

## 1. Final Architecture

```
 Watchman phone (PWA)          Resident phones (PWA)
        |                              |
        |  HTTPS + JWT                 |  HTTPS + JWT
        v                              v
 +------------------------------------------------+
 |  FastAPI backend (Python)                       |
 |  - auth + roles   - visits   - admin           |
 |  - sends push via Firebase Cloud Messaging     |
 +------------------------+-----------------------+
                          |
                    MySQL database
```

Stack: FastAPI + SQLAlchemy + MySQL, React PWA frontend, Firebase Cloud Messaging for push, Caddy/nginx for HTTPS, a small VPS (or any always-on server) for hosting.

---

## 2. Project Folder Structure

```
gatepass/
├── backend/
│   ├── main.py            # all API routes
│   ├── models.py          # DB tables
│   ├── schemas.py         # request/response validation
│   ├── database.py        # DB connection
│   ├── security.py        # PIN hashing, JWT, login lockout
│   ├── deps.py            # "who is calling / are they allowed"
│   ├── create_admin.py    # run once to create first admin
│   ├── push.py            # (Phase 3) Firebase push sender
│   ├── requirements.txt
│   └── .env               # secrets (NEVER commit)
│
├── frontend/              # React PWA (Phase 2)
│   ├── public/
│   │   ├── manifest.json            # makes it installable
│   │   └── firebase-messaging-sw.js # receives push in background
│   └── src/
│       ├── api.js                   # fetch wrapper (adds token)
│       ├── auth.js                  # login state
│       ├── pages/
│       │   ├── Login.jsx
│       │   ├── watchman/NewVisit.jsx
│       │   ├── watchman/VisitStatus.jsx
│       │   ├── resident/Pending.jsx
│       │   ├── resident/History.jsx
│       │   └── admin/Users.jsx
│       └── App.jsx                  # routes by role
│
└── deploy/
    ├── Caddyfile          # HTTPS reverse proxy
    └── gatepass.service   # keeps backend running
```

---

## 3. Database (4 tables)

| Table | Key columns |
|---|---|
| `flats` | id, flat_no |
| `users` | id, name, phone, pin_hash, role, flat_id, is_active, fcm_token |
| `visit_requests` | id, guest_name, guest_phone, flat_id, purpose, status, requested_by, decided_by, created_at, decided_at, checkin_at, checkout_at |
| `pre_approvals` (Phase 5) | id, flat_id, code_hash, guest_name, valid_until, used |

Visit status flow:

```
PENDING -> APPROVED -> CHECKED_IN -> CHECKED_OUT
   |-----> REJECTED
   |-----> EXPIRED (no reply in 2 min)
```

---

## 4. API (built = done)

| Endpoint | Who | Status |
|---|---|---|
| POST /auth/login | anyone | built |
| GET /auth/me | any user | built |
| POST /admin/flats/{no} | admin | built |
| POST /admin/users | admin | built |
| GET /admin/users | admin | built |
| PATCH /admin/users/{id}/disable | admin | built |
| POST /visits | watchman | built |
| GET /visits/pending | resident (own flat) | built |
| GET /visits/history | resident / admin | built |
| GET /visits/{id} | watchman / resident (own flat) / admin | built |
| PATCH /visits/{id}/decision | resident (own flat) | built |
| PATCH /visits/{id}/checkin | watchman | built |
| PATCH /visits/{id}/checkout | watchman | built |
| POST /me/fcm-token | any user | Phase 3 |
| POST /pre-approvals, POST /pre-approvals/verify | resident / watchman | Phase 5 |

---

## 5. Phases (in order)

### Phase 1: Backend core (DONE)
- Tables, visit flow, 2-minute auto-expiry
- PIN login, JWT, roles, lockout after 5 wrong attempts
- Admin: add flats, add users, disable user
- Check-in / check-out
- Tested: 28 checks including wrong-role and wrong-flat attacks

### Phase 2: Frontend PWA
- Login screen
- Watchman: New Visit form -> Waiting screen (polls `GET /visits/{id}` every 3 s) -> big green ALLOW or red DENY -> Check in / Check out buttons
- Resident: Pending list (polls every 5 s) with Approve / Reject buttons, plus History
- Admin: add resident / watchman, disable user
- Make it installable (manifest + service worker)

### Phase 3: Push notifications
- Create a Firebase project (free), add the web app
- Frontend saves the device token -> `POST /me/fcm-token`
- Backend `push.py` sends: on new visit -> resident phones of that flat; on decision -> watchman phone
- Keep polling as fallback if push fails

### Phase 4: Deploy
- Rent a small VPS, install MySQL, run backend with systemd
- Caddy in front for automatic HTTPS (free certificate)
- Set env vars: `ENV=production`, `JWT_SECRET`, `DATABASE_URL`, `DOCS=off`
- Restrict CORS to the app's own domain
- Nightly DB backup (mysqldump to another location)
- Create admin: `python create_admin.py "Name" <phone> <pin>`

### Phase 5: Extras (only after real use)
- Pre-approved guest codes (single-use, expiring, locked to one flat, max 3 wrong tries)
- Delivery "leave at gate" option
- Guest photo from watchman's camera
- Monthly visitor report for admin

### Phase 6: Rollout
1. Test with you + 1 neighbour + 1 watchman for a week
2. Fix what annoys people
3. Add all 15 flats
4. Give the watchman a 10-minute demo (big buttons, minimal typing)

---

## 6. Security Checklist

- [x] Login required on every endpoint except /auth/login
- [x] Role checks (watchman / resident / admin)
- [x] Resident can only see and decide visits of own flat (identity from token, not request)
- [x] PINs hashed (PBKDF2), never stored plain
- [x] Login lockout after 5 wrong attempts
- [x] Same error for wrong phone and wrong PIN
- [x] Disabled users are cut off on their very next request
- [x] Input validation (phone format, length limits)
- [x] Approval is atomic (two phones tapping together can't both win)
- [x] Production refuses to start without JWT_SECRET
- [ ] HTTPS (Phase 4)
- [ ] CORS locked to your domain (Phase 4)
- [ ] Docs page turned off in production (`DOCS=off`, Phase 4)
- [ ] DB backups (Phase 4)
- [ ] Never commit `.env` or the Firebase key to git
- [ ] Change the PIN policy: ask residents to avoid 1234 / 0000

Known limits for now:
- Login lockout lives in memory, so it resets if the server restarts. Fine for one server.
- JWT cannot be revoked before it expires, but the DB `is_active` check covers lost phones.

---

## 7. Rough Timeline (part-time)

| Phase | Time |
|---|---|
| 1 Backend | done |
| 2 Frontend | 5-7 days |
| 3 Push | 2-3 days |
| 4 Deploy | 1-2 days |
| 5 Extras | as needed |
| 6 Rollout | 1 week of trial |

---

## 8. Run the Backend Now

```
cd gatepass
pip install -r requirements.txt
python create_admin.py "Srikar" 9876543210 123456
uvicorn main:app --reload
# open http://127.0.0.1:8000/docs  -> click Authorize after logging in at /auth/login
```
