alter table public.profile_onboarding
  add column if not exists sex text;

alter table public.profile_onboarding
  drop constraint if exists profile_onboarding_sex_allowed;

alter table public.profile_onboarding
  add constraint profile_onboarding_sex_allowed
  check (
    sex is null
    or sex in ('male', 'female', 'prefer_not_to_say')
  );
