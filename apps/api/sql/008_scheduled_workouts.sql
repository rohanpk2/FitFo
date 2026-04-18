create extension if not exists pgcrypto;

-- Scheduled workouts place a saved workout on a specific calendar date for a user.
-- The source_workout_id points at saved_workouts when available so edits to the saved
-- copy propagate, while the denormalized title/plan columns keep the card renderable
-- even if the saved library row is later deleted.
create table if not exists public.scheduled_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source_workout_id uuid null references public.saved_workouts (id) on delete set null,
  workout_id uuid null references public.workouts (id) on delete set null,
  job_id uuid null references public.ingestion_jobs (id) on delete set null,
  source_url text null,
  scheduled_for date not null,
  status text not null default 'scheduled',
  title text not null,
  description text null,
  meta_left text null,
  meta_right text null,
  badge_label text null,
  workout_plan jsonb null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint scheduled_workouts_status_check
    check (status in ('scheduled', 'completed', 'skipped', 'cancelled'))
);

create index if not exists scheduled_workouts_user_date_idx
  on public.scheduled_workouts (user_id, scheduled_for asc);

create index if not exists scheduled_workouts_user_status_idx
  on public.scheduled_workouts (user_id, status);

drop trigger if exists scheduled_workouts_set_updated_at on public.scheduled_workouts;
create trigger scheduled_workouts_set_updated_at
before update on public.scheduled_workouts
for each row
execute function public.set_workout_records_updated_at();

alter table public.scheduled_workouts enable row level security;

drop policy if exists "scheduled_workouts_select_own" on public.scheduled_workouts;
create policy "scheduled_workouts_select_own"
on public.scheduled_workouts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "scheduled_workouts_insert_own" on public.scheduled_workouts;
create policy "scheduled_workouts_insert_own"
on public.scheduled_workouts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "scheduled_workouts_update_own" on public.scheduled_workouts;
create policy "scheduled_workouts_update_own"
on public.scheduled_workouts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "scheduled_workouts_delete_own" on public.scheduled_workouts;
create policy "scheduled_workouts_delete_own"
on public.scheduled_workouts
for delete
to authenticated
using (auth.uid() = user_id);
