# Apartment Gate Pass

Watchman enters a guest's details -> the flat's resident approves or rejects in the app -> watchman sees ALLOW or DENY.
Built for a 15-flat apartment. See `PLAN.md` for the full plan and security checklist.

- Backend: FastAPI + SQLAlchemy (SQLite by default, MySQL optional)
- Frontend: React (Vite) installable web app (PWA)

## Run it on your computer

You need Python 3.10+ and Node 18+.

### 1. Backend
```
pip install -r requirements.txt
python create_admin.py "Your Name" 9876543210 123456
uvicorn main:app --reload
```
API docs: http://127.0.0.1:8000/docs

The first admin is created by `create_admin.py`. Everything else (flats, watchmen, residents) is added from the admin screens in the app.

### 2. Frontend
```
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 and log in with the admin phone and PIN.

### 3. Try the whole flow
1. Log in as admin -> **Flats** tab: add your flats. **Add person**: add one watchman and one resident (pick their flat).
2. Open a private/incognito window, log in as the watchman -> **+ New visitor**.
3. Open another window, log in as the resident -> **Approve**.
4. The watchman screen turns green: **ALLOW**.

### Testing on a phone (same Wi-Fi)
Run the backend with `--host 0.0.0.0`, open `http://<your-computer-ip>:5173` on the phone, and start the backend with
`CORS_ORIGINS=http://<your-computer-ip>:5173`.

## Settings (environment variables)

| Variable | What it does | Default |
|---|---|---|
| `DATABASE_URL` | Database, e.g. `mysql+pymysql://user:pass@localhost:3306/gatepass` | local SQLite file |
| `JWT_SECRET` | Secret used to sign login tokens. **Required in production.** | dev value |
| `ENV` | Set to `production` on the real server | unset |
| `CORS_ORIGINS` | Web addresses allowed to call the API, comma separated | `http://localhost:5173,http://127.0.0.1:5173` |
| `DOCS` | Set to `off` to hide `/docs` in production | on |
| `TOKEN_HOURS` | How long a login lasts | 12 |
| `VITE_API_URL` (frontend/.env) | Backend address the app talks to | same host, port 8000 |
| `VITE_FIREBASE_VAPID_KEY` (frontend/.env) | Web push key from Firebase (starts with `B`). Without it the alerts banner stays hidden. | unset |
| `FIREBASE_CREDENTIALS` | Path to the Firebase service-account JSON on the server. Without it push is simply off. | unset |

Never commit a `.env` file or any key. `.gitignore` already skips them.

## Push notifications (alerts when the app is closed)

Residents get "Visitor at the gate" and the watchman gets "Flat 101: APPROVED" even with the app closed.
Everything works without this (the app checks the server every few seconds while it is open).

**One-time setup**
1. Firebase console -> your project -> Project settings -> **Cloud Messaging** -> Web configuration -> **Generate key pair**.
2. Create `frontend/.env` with one line: `VITE_FIREBASE_VAPID_KEY=<that key>` (see `frontend/.env.example`), then restart `npm run dev`.
3. Firebase console -> Project settings -> **Service accounts** -> **Generate new private key**. Save the JSON **outside the repo** (it is a secret).
4. Start the backend with the path set (Windows PowerShell):
   ```
   $env:FIREBASE_CREDENTIALS="C:\keys\gatepass-service-account.json"
   uvicorn main:app --reload
   ```
5. In the app, log in as a resident or watchman and tap **Turn on alerts**, then Allow.

Push only works on **HTTPS** (or `localhost` on the same computer). On a phone it needs the deployed HTTPS address.
On iPhone, add the app to the Home Screen first (iOS 16.4+).

Each person keeps one push address, from the last phone they turned alerts on. Logging out stops alerts to that phone.
