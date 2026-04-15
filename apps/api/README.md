# LiftSync-Backend

FastAPI service for LiftSync. Env vars: see `.env.example`.

## Run locally

Use **Python 3.12–3.14** (FastAPI / Pydantic do not support **3.15** yet). On macOS with Homebrew: `brew install python@3.12`.

```bash
python3.12 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
ok 
cp .env.example .env       # add Supabase URL + service role when you wire storage
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: `GET http://localhost:8000/health`

Ingest: `POST http://localhost:8000/ingest` with JSON `{"source_url":"..."}`. Validates via TikTok **oEmbed**; on success inserts **`ingestion_jobs`** (`status: pending`) and returns **`job_id`**. Requires **`SUPABASE_SERVICE_ROLE_KEY`** and DB setup from `sql/001_ingestion_jobs.sql` (run in Supabase SQL editor).

Phone OTP auth flow:

- Run `sql/002_profiles.sql` and then `sql/004_profiles_backend_auth.sql` in the Supabase SQL editor.
- Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_SERVICE_SID`, `TWILIO_VERIFY_FRIENDLY_NAME`, `APP_JWT_SECRET`, and `APP_JWT_EXPIRES_IN_SECONDS` to `apps/api/.env`.
- `POST /auth/account-status` normalizes a phone number and reports whether a matching `profiles` row already exists.
- `POST /auth/send-otp` sends an SMS code through Twilio Verify for login or signup.
- `POST /auth/verify-otp` checks the code, signs the user in, and returns a backend bearer token plus the profile.
- `GET /auth/me` restores the current user from that backend bearer token.

## Dependencies

- `ffmpeg` is required to extract audio for transcription.

```bash
brew install ffmpeg
```

API docs: `http://localhost:8000/docs`
