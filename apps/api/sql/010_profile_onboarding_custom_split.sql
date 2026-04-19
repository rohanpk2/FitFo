alter table public.profile_onboarding
  add column if not exists custom_split_notes text;

alter table public.profile_onboarding
  drop constraint if exists profile_onboarding_custom_split_notes_length;

alter table public.profile_onboarding
  add constraint profile_onboarding_custom_split_notes_length
  check (
    custom_split_notes is null
    or char_length(custom_split_notes) between 1 and 500
  );

alter table public.profile_onboarding
  drop constraint if exists profile_onboarding_custom_split_notes_required;

alter table public.profile_onboarding
  add constraint profile_onboarding_custom_split_notes_required
  check (
    training_split <> 'custom'
    or (
      custom_split_notes is not null
      and char_length(btrim(custom_split_notes)) > 0
    )
  );
