-- FROZEN SPEC FILE. Do not edit (see docs/CONTRACTS.md).
-- Installs pgTAP and the small helper schema "tests" used by every spec file.
-- Runs first (alphabetical order) and is NOT rolled back, so later files can use the helpers.

create extension if not exists pgtap with schema extensions;

create schema if not exists tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Create an auth user (no profile). Returns its id.
create or replace function tests.create_user(identifier text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := gen_random_uuid();
begin
  insert into auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          identifier || '@spec.ihodim.test', '{}'::jsonb,
          jsonb_build_object('spec_identifier', identifier), now(), now());
  return uid;
end;
$$;

-- Id of a user created with tests.create_user / tests.create_member.
create or replace function tests.uid(identifier text)
returns uuid
language sql
stable
security definer
set search_path = public, extensions
as $$
  select id from auth.users where email = identifier || '@spec.ihodim.test';
$$;

-- Create an auth user plus profile + profile_private (a "member"). Username = identifier.
-- Must be called as the postgres role (bypasses RLS on purpose: this is fixture setup).
create or replace function tests.create_member(identifier text, dob date default '2000-01-01', admin boolean default false)
returns uuid
language plpgsql
set search_path = public, extensions
as $$
declare
  uid uuid := tests.create_user(identifier);
begin
  execute 'insert into public.profiles (id, username, is_admin) values ($1, $2, $3)' using uid, identifier, admin;
  execute 'insert into public.profile_private (user_id, date_of_birth) values ($1, $2)' using uid, dob;
  return uid;
end;
$$;

-- Act as a signed-in user for the rest of the transaction.
create or replace function tests.authenticate_as(identifier text)
returns void
language plpgsql
set search_path = public, extensions
as $$
declare
  uid uuid := tests.uid(identifier);
begin
  if uid is null then
    raise exception 'spec helper: unknown test user %', identifier;
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Act as an anonymous (signed-out) client.
create or replace function tests.as_anon()
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('role', 'anon', true);
end;
$$;

-- Run a statement as the current role and swallow any error.
-- Returns a TAP comment line ('# ...') so it never affects the test count.
-- Use it for "this must not take effect" checks, then verify the data afterwards as postgres.
create or replace function tests.attempt(sql text)
returns text
language plpgsql
as $$
begin
  execute sql;
  return '# attempted: statement ran (check the data to see if it took effect)';
exception when others then
  return '# attempted: refused with ' || sqlstate;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

begin;
select plan(1);
select ok(true, 'spec helpers installed');
select * from finish();
rollback;
