create extension if not exists pgcrypto;

drop trigger if exists profiles_set_updated_at on public.profiles;
drop trigger if exists on_auth_user_created on auth.users;

drop function if exists public.handle_new_phone_user();
drop function if exists public.set_profiles_updated_at();

drop table if exists public.profiles;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  phone text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profiles_phone_idx on public.profiles (phone);

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_profiles_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

create or replace function public.handle_new_phone_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  raw_name text;
begin
  if new.phone is null or trim(new.phone) = '' then
    return new;
  end if;

  raw_name := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');

  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(raw_name, 'Fitfo User'),
    coalesce(new.phone, '')
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    phone = excluded.phone,
    updated_at = timezone('utc', now());

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_phone_user();

insert into public.profiles (id, full_name, phone)
select
  users.id,
  coalesce(
    nullif(trim(coalesce(users.raw_user_meta_data ->> 'full_name', '')), ''),
    'Fitfo User'
  ),
  users.phone
from auth.users as users
where users.phone is not null
  and trim(users.phone) <> ''
on conflict (id) do update
set
  full_name = excluded.full_name,
  phone = excluded.phone,
  updated_at = timezone('utc', now());
