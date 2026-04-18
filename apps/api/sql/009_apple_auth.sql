create extension if not exists pgcrypto;

-- Sign in with Apple identifies users by a stable `sub` claim unique per Apple ID
-- and per app bundle. Store that as apple_user_id. We also capture the email Apple
-- returns on the first sign-in (which may be a private relay address).
alter table public.profiles
  add column if not exists apple_user_id text null,
  add column if not exists email text null;

-- Apple-only accounts don't have a phone number. Existing phone-based auth still
-- works because the column remains; we just relax the NOT NULL constraint.
alter table public.profiles
  alter column phone drop not null;

-- Apple's `sub` is globally unique per app, so we enforce that at the DB level.
create unique index if not exists profiles_apple_user_id_uidx
  on public.profiles (apple_user_id)
  where apple_user_id is not null;

-- Guarantee every profile has at least one identity (phone, Apple ID, or both).
-- Apple-only accounts keep email as a nice-to-have but it is not considered an
-- identity because Apple private relay emails aren't a reliable account key.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_identity_present_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_identity_present_check
      check (phone is not null or apple_user_id is not null);
  end if;
end;
$$;
