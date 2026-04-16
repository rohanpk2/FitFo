# FitFo API

FastAPI backend for FitFo. This service handles phone-based auth, TikTok workout ingestion, saved workouts, and per-user workout history.

## Run locally

Use Python 3.12 when possible.

```bash
python3.12 -m venv .venv
source .venv/bin/activate
cp .env.example .env
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Health check: `GET http://localhost:8000/health`

## Required env vars

Add these to `apps/api/.env`:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GROQ_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SERVICE_SID`
- `TWILIO_VERIFY_FRIENDLY_NAME`
- `APP_JWT_SECRET`
- `APP_JWT_EXPIRES_IN_SECONDS`

Optional:

- `SUPABASE_STORAGE_BUCKET` if you do not want to use the default `raw-media` bucket

## Database setup

Run these SQL files in the Supabase SQL editor, in order:

1. `sql/002_profiles.sql`
2. `sql/004_profiles_backend_auth.sql`
3. `sql/005_workout_persistence.sql`
4. `sql/006_profile_onboarding.sql`
5. `sql/007_body_weight_entries.sql`

`sql/003_profiles_auth_link.sql` is legacy and only applies to an older `auth.users`-linked profile setup. The current backend OTP flow uses `sql/004_profiles_backend_auth.sql`, which preserves `profiles` data and detaches any stale `auth.users` linkage instead of dropping the table.

`005_workout_persistence.sql` adds account-scoped workout persistence:

- `user_id` ownership columns on `ingestion_jobs` and `workouts`
- `saved_workouts` for Save Workout for Later
- `completed_workouts` for workout history and summary pages
- indexes and `updated_at` triggers for the new tables
- per-user RLS policies keyed off `auth.uid()`
- repair logic for older installs where `ingestion_jobs.user_id` or `workouts.user_id` still referenced a legacy `users` table

## Auth flow

- `POST /auth/account-status` checks whether a normalized phone number already has an account
- `POST /auth/send-otp` sends the verification code
- `POST /auth/verify-otp` verifies the code and returns the backend bearer token
- `GET /auth/me` restores the current user from that bearer token
- `PUT /auth/onboarding` saves the first-run onboarding profile for the authenticated user

The mobile app stores only the auth session locally. Workout data now loads from the backend after login, so saved workouts and history survive logout/login and device changes.

## Workout persistence endpoints

These endpoints require the backend bearer token in `Authorization: Bearer <token>`.

- `POST /ingest`
- `GET /jobs/{job_id}`
- `GET /jobs/{job_id}/workout`
- `GET /saved-workouts`
- `POST /saved-workouts`
- `DELETE /saved-workouts/{saved_workout_id}`
- `GET /completed-workouts`
- `GET /completed-workouts/{completed_workout_id}`
- `POST /completed-workouts`
- `GET /body-weight`
- `POST /body-weight`

The backend uses the authenticated profile id to scope every workout read/write so users can only access their own saved workouts, imported workouts, and completed workout logs.

## Media dependencies

`ffmpeg` is required for audio extraction.

```bash
brew install ffmpeg
```

The ingestion flow uses the original simpler pipeline:

- download the source video
- extract the full audio track with `ffmpeg`
- transcribe that audio directly with Whisper

## Docs

Interactive docs: `http://localhost:8000/docs`
