create extension if not exists pgcrypto;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_phone_user();

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

update public.profiles
set
  full_name = coalesce(nullif(trim(full_name), ''), 'FitFo User'),
  phone = coalesce(nullif(trim(phone), ''), id::text)
where full_name is null
   or trim(full_name) = ''
   or phone is null
   or trim(phone) = '';

alter table public.profiles
  alter column id set default gen_random_uuid(),
  alter column full_name set not null,
  alter column phone set not null,
  alter column created_at set default timezone('utc', now()),
  alter column updated_at set default timezone('utc', now());

do $$
declare
  constraint_name text;
begin
  -- Older installs may still have profiles.id linked to auth.users. Backend auth uses its own profile ids,
  -- so we detach that FK in place instead of dropping the whole profiles table and losing account data.
  for constraint_name in
    select tc.constraint_name
    from information_schema.table_constraints as tc
    join information_schema.key_column_usage as kcu
      on tc.constraint_name = kcu.constraint_name
     and tc.table_schema = kcu.table_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'profiles'
      and tc.constraint_type = 'FOREIGN KEY'
      and kcu.column_name = 'id'
  loop
    execute format(
      'alter table public.profiles drop constraint if exists %I',
      constraint_name
    );
  end loop;
end;
$$;

create index if not exists profiles_phone_idx on public.profiles (phone);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_phone_key'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_phone_key unique (phone);
  end if;
end;
$$;

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();
