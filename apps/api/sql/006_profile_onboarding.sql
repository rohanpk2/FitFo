create extension if not exists pgcrypto;

create table if not exists public.profile_onboarding (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  goals text[] not null default '{}',
  training_split text not null,
  days_per_week integer not null,
  weight_lbs numeric(5, 1) not null,
  height_inches integer not null,
  experience_level text not null,
  age integer not null,
  completed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profile_onboarding_goals_not_empty
    check (cardinality(goals) > 0),
  constraint profile_onboarding_goals_allowed
    check (
      goals <@ array[
        'build_muscle',
        'lose_fat',
        'get_stronger',
        'improve_cardio',
        'stay_active',
        'athletic_performance'
      ]::text[]
    ),
  constraint profile_onboarding_training_split_allowed
    check (
      training_split in (
        'ppl',
        'upper_lower',
        'bro_split',
        'full_body',
        'five_three_one',
        'arnold_split',
        'custom'
      )
    ),
  constraint profile_onboarding_days_per_week_check
    check (days_per_week between 1 and 7),
  constraint profile_onboarding_weight_lbs_check
    check (weight_lbs > 0 and weight_lbs <= 1000),
  constraint profile_onboarding_height_inches_check
    check (height_inches between 36 and 96),
  constraint profile_onboarding_experience_level_allowed
    check (experience_level in ('beginner', 'intermediate', 'advanced')),
  constraint profile_onboarding_age_check
    check (age between 13 and 120)
);

create index if not exists profile_onboarding_completed_at_idx
  on public.profile_onboarding (completed_at desc);

create or replace function public.set_profile_onboarding_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profile_onboarding_set_updated_at on public.profile_onboarding;

create trigger profile_onboarding_set_updated_at
before update on public.profile_onboarding
for each row
execute function public.set_profile_onboarding_updated_at();
