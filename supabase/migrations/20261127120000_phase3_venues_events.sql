-- Phase 3: venues and events. Contract: docs/CONTRACTS.md "Phase 3". Spec: supabase/tests/database/030-*.
-- Entered by admins only (CLAUDE.md: no club logins in v1). Members read everything; nobody else reads anything.

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  phone text not null,
  checkin_radius_m integer not null default 100 check (checkin_radius_m > 0),
  -- Local Sofia time. An end earlier than the start means the window crosses midnight (Q14).
  checkin_window_start time not null default '22:00',
  checkin_window_end time not null default '04:00',
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues (id) on delete cascade,
  performer text not null,
  starts_at timestamptz not null,
  -- Free text. Nothing is sold or discounted in the app.
  promo text,
  created_by uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Covers the FK and the venue page's "upcoming events in date order" query.
create index events_venue_starts_idx on public.events (venue_id, starts_at);

-- Row Level Security and grants -------------------------------------------------------------------------------------
alter table public.venues enable row level security;
alter table public.events enable row level security;

-- revoke all also drops Supabase's default TRUNCATE grant, which bypasses RLS.
revoke all on table public.venues, public.events from anon, authenticated;
-- anon gets SELECT but no policy, so RLS returns 0 rows instead of a permission error (spec 030: anon reads none).
grant select on table public.venues, public.events to anon, authenticated;
grant insert, update, delete on table public.venues, public.events to authenticated;

create policy venues_select_member on public.venues
  for select to authenticated using ((select public.is_member()));
create policy venues_insert_admin on public.venues
  for insert to authenticated with check ((select public.is_admin()));
create policy venues_update_admin on public.venues
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy venues_delete_admin on public.venues
  for delete to authenticated using ((select public.is_admin()));

create policy events_select_member on public.events
  for select to authenticated using ((select public.is_member()));
create policy events_insert_admin on public.events
  for insert to authenticated with check ((select public.is_admin()));
create policy events_update_admin on public.events
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy events_delete_admin on public.events
  for delete to authenticated using ((select public.is_admin()));
