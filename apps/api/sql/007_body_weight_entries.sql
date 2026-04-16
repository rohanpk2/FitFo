create extension if not exists pgcrypto;

create table if not exists public.body_weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  weight_lbs numeric(5, 1) not null,
  source text not null default 'manual',
  recorded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint body_weight_entries_weight_lbs_check
    check (weight_lbs > 0 and weight_lbs <= 1000),
  constraint body_weight_entries_source_check
    check (source in ('onboarding', 'manual'))
);

create index if not exists body_weight_entries_user_recorded_idx
  on public.body_weight_entries (user_id, recorded_at asc);

create or replace function public.set_body_weight_entries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists body_weight_entries_set_updated_at on public.body_weight_entries;

create trigger body_weight_entries_set_updated_at
before update on public.body_weight_entries
for each row
execute function public.set_body_weight_entries_updated_at();

insert into public.body_weight_entries (
  user_id,
  weight_lbs,
  source,
  recorded_at
)
select
  onboarding.user_id,
  onboarding.weight_lbs,
  'onboarding',
  coalesce(onboarding.completed_at, onboarding.created_at, timezone('utc', now()))
from public.profile_onboarding as onboarding
where not exists (
  select 1
  from public.body_weight_entries as entries
  where entries.user_id = onboarding.user_id
);
