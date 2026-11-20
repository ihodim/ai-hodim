-- Phase 1: accounts and profiles. Contract: docs/CONTRACTS.md "Phase 1". Spec: supabase/tests/database/010-*.
-- Rows are created only by the complete-signup Edge Function (service role). Clients can read their own rows and
-- change only username and stats_visibility. Friend, pending-request and tag read rules arrive in phases 2 and 4.

create extension if not exists citext with schema extensions;

create type public.stats_visibility as enum ('friends', 'hidden');

-- profiles: public identity --------------------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- citext makes the unique constraint case-insensitive (Ivan = ivan, Q3).
  username extensions.citext not null,
  is_admin boolean not null default false,
  stats_visibility public.stats_visibility not null default 'friends',
  created_at timestamptz not null default now(),
  constraint profiles_username_key unique (username),
  -- Cast to text: the citext ~ operator is case-insensitive. Same regex as supabase/functions/_shared/username.ts.
  constraint profiles_username_format check (username::text ~ '^[A-Za-z][A-Za-z0-9_.]{2,19}$')
);

comment on table public.profiles is 'Public identity. Created only by the complete-signup Edge Function.';
comment on column public.profiles.is_admin is 'Set by the developers with SQL. No client can change it.';

-- profile_private: data only the owner sees -------------------------------------------------------------------------
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  date_of_birth date not null,
  -- 18+ is enforced here, not only in the form (CLAUDE.md). current_date is UTC on Supabase (Q6).
  constraint profile_private_adult check (date_of_birth <= current_date - interval '18 years')
);

comment on table public.profile_private is 'Owner-only data. Inserted once by complete-signup, never updated by clients (Q4).';

-- Row Level Security and grants -------------------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.profile_private enable row level security;

-- Start from nothing, then grant exactly what the contract allows.
revoke all on table public.profiles, public.profile_private from anon, authenticated;

-- anon gets SELECT but no policy, so RLS returns 0 rows instead of a permission error (spec 010: anon reads none).
grant select on table public.profiles to anon, authenticated;
grant update (username, stats_visibility) on table public.profiles to authenticated;
grant select on table public.profile_private to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy profile_private_select_own on public.profile_private
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Helper functions ---------------------------------------------------------------------------------------------------
-- security definer so later policies can call them without recursing through profiles RLS. They only ever
-- answer about the caller (auth.uid()), so exposing them in public reveals nothing about other users.
create function public.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.profiles where id = (select auth.uid()));
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select is_admin from public.profiles where id = (select auth.uid())), false);
$$;

revoke execute on function public.is_member(), public.is_admin() from public, anon;
grant execute on function public.is_member(), public.is_admin() to authenticated, service_role;

-- Internal: creates both signup rows in one transaction. Called only by complete-signup with the service role,
-- which bypasses RLS, so this stays security invoker.
create function public.create_signup_rows(p_user_id uuid, p_username text, p_dob date)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.profiles (id, username) values (p_user_id, p_username::extensions.citext);
  insert into public.profile_private (user_id, date_of_birth) values (p_user_id, p_dob);
end;
$$;

revoke execute on function public.create_signup_rows(uuid, text, date) from public, anon, authenticated;
grant execute on function public.create_signup_rows(uuid, text, date) to service_role;
