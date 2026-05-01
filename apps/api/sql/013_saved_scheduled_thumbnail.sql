-- Optional cover image URL captured at save/schedule time (CDN URLs are
-- short-lived; cards may fall back to placeholder when stale).
alter table if exists public.saved_workouts
  add column if not exists thumbnail_url text null;

alter table if exists public.scheduled_workouts
  add column if not exists thumbnail_url text null;
