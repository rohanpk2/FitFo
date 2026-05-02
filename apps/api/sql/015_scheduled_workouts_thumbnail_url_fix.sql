-- Fix Postgres 42703: column scheduled_workouts.thumbnail_url does not exist
-- (Happens when 013_saved_scheduled_thumbnail.sql was not run on this project.)
-- Idempotent — safe if 013 already applied.
alter table if exists public.scheduled_workouts
  add column if not exists thumbnail_url text null;

alter table if exists public.saved_workouts
  add column if not exists thumbnail_url text null;
