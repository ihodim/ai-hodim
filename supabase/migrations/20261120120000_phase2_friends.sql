-- Phase 2: friendships and blocking. Contract: docs/CONTRACTS.md "Phase 2". Spec: supabase/tests/database/020-*.
-- One row per pair of users. Clients only read; every write goes through the security definer RPCs below, so the
-- rules live in one place. A block replaces the pair's row, so every "friends only" rule hides blocked pairs too.

create type public.friendship_status as enum ('pending', 'accepted', 'blocked');

create table public.friendships (
  requester_id uuid not null references public.profiles (id) on delete cascade,
  -- For a block, requester_id is the blocker.
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status public.friendship_status not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint friendships_pkey primary key (requester_id, addressee_id),
  constraint friendships_not_self check (requester_id <> addressee_id)
);

-- One row per pair, whichever direction it points.
create unique index friendships_pair_key
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
-- The primary key covers lookups by requester_id; this covers the addressee side and the FK.
create index friendships_addressee_idx on public.friendships (addressee_id);

comment on table public.friendships is 'One row per pair. Written only by the friendship RPCs.';

-- Row Level Security and grants -------------------------------------------------------------------------------------
alter table public.friendships enable row level security;

revoke all on table public.friendships from anon, authenticated;
grant select on table public.friendships to authenticated;

-- Both users see pending and accepted rows; only the blocker sees a blocked row (Q12: the blocked user can't tell).
create policy friendships_select_party on public.friendships
  for select to authenticated
  using (
    case status
      when 'blocked' then requester_id = (select auth.uid())
      else (select auth.uid()) in (requester_id, addressee_id)
    end
  );

-- Profiles: friends and pending-request pairs (either direction) can read each other. This reads friendships
-- through the caller's own RLS, which only shows rows the caller is part of, and a block replaces the pending or
-- accepted row, so blocking hides the profile again.
create policy profiles_select_connected on public.profiles
  for select to authenticated
  using (
    exists (
      select 1
      from public.friendships f
      where f.status in ('pending', 'accepted')
        and (
          (f.requester_id = (select auth.uid()) and f.addressee_id = profiles.id)
          or (f.addressee_id = (select auth.uid()) and f.requester_id = profiles.id)
        )
    )
  );

-- Helper: are_friends ------------------------------------------------------------------------------------------------
-- security definer so later policies (plans, check-ins, stats) can call it without recursing through RLS.
-- Symmetric, and true only for accepted rows. Not limited to pairs that include the caller: later policies
-- ask about the creator and a third person (e.g. friends of a plan's creator).
create function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = a and f.addressee_id = b) or (f.requester_id = b and f.addressee_id = a))
    );
$$;

-- Search -------------------------------------------------------------------------------------------------------------
-- Exact, case-insensitive match. The search_path is empty, so the citext operator must be named explicitly:
-- an unqualified `=` silently falls back to case-sensitive text comparison. This also uses the unique index.
-- Never returns either side of a block (Q12), and returns nothing to non-members.
create function public.find_user_by_username(p_username text)
returns table (id uuid, username extensions.citext)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username
  from public.profiles p
  where public.is_member()
    and p.username operator(extensions.=) p_username::extensions.citext
    and not exists (
      select 1
      from public.friendships f
      where f.status = 'blocked'
        and least(f.requester_id, f.addressee_id) = least(p.id, (select auth.uid()))
        and greatest(f.requester_id, f.addressee_id) = greatest(p.id, (select auth.uid()))
    );
$$;

-- Friendship RPCs ------------------------------------------------------------------------------------------------------
-- Every refusal raises P0001 (CONTRACTS general rules). A request to someone who blocked you fails with the same
-- generic message as any other existing pair, so the blocked user can't tell (Q12).

create function public.send_friend_request(p_addressee uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null or not public.is_member() then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  if p_addressee is null or p_addressee = v_me then
    raise exception 'request_not_allowed' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_addressee) then
    raise exception 'request_not_allowed' using errcode = 'P0001';
  end if;

  insert into public.friendships (requester_id, addressee_id, status)
  values (v_me, p_addressee, 'pending');
exception
  -- Any existing row for the pair (pending, accepted or blocked, either direction) hits the pair index.
  when unique_violation then
    raise exception 'request_not_allowed' using errcode = 'P0001';
end;
$$;

create function public.accept_request(p_requester uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.friendships
  set status = 'accepted', updated_at = now()
  where requester_id = p_requester
    and addressee_id = (select auth.uid())
    and status = 'pending';
  if not found then
    raise exception 'no_pending_request' using errcode = 'P0001';
  end if;
end;
$$;

create function public.decline_request(p_requester uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where requester_id = p_requester
    and addressee_id = (select auth.uid())
    and status = 'pending';
  if not found then
    raise exception 'no_pending_request' using errcode = 'P0001';
  end if;
end;
$$;

-- Not in the contract: lets the requester withdraw their own pending request.
create function public.cancel_request(p_addressee uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where requester_id = (select auth.uid())
    and addressee_id = p_addressee
    and status = 'pending';
  if not found then
    raise exception 'no_pending_request' using errcode = 'P0001';
  end if;
end;
$$;

create function public.unfriend(p_friend uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  delete from public.friendships
  where status = 'accepted'
    and ((requester_id = v_me and addressee_id = p_friend) or (requester_id = p_friend and addressee_id = v_me));
  if not found then
    raise exception 'not_friends' using errcode = 'P0001';
  end if;
end;
$$;

-- Replaces any row for the pair with caller -> target, blocked (CONTRACTS, literally). Known gap, raised for a
-- spec-change decision: if the target had already blocked the caller, blocking back and then unblocking lifts the
-- original block. One row per pair can't represent a mutual block.
create function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
begin
  if v_me is null or not public.is_member() then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  if p_target is null or p_target = v_me or not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'block_not_allowed' using errcode = 'P0001';
  end if;

  delete from public.friendships
  where (requester_id = v_me and addressee_id = p_target) or (requester_id = p_target and addressee_id = v_me);
  insert into public.friendships (requester_id, addressee_id, status)
  values (v_me, p_target, 'blocked');
end;
$$;

create function public.unblock_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.friendships
  where requester_id = (select auth.uid())
    and addressee_id = p_target
    and status = 'blocked';
  if not found then
    raise exception 'not_blocked' using errcode = 'P0001';
  end if;
end;
$$;

-- Not in the contract: the blocker's own blocked list with usernames, for the settings screen. The contract's
-- profile read rules don't let a blocker read the blocked user's profile, so this returns only the username.
create function public.list_blocked()
returns table (id uuid, username extensions.citext)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username
  from public.friendships f
  join public.profiles p on p.id = f.addressee_id
  where f.requester_id = (select auth.uid())
    and f.status = 'blocked'
  order by p.username;
$$;

-- Execute grants: signed-in users only ---------------------------------------------------------------------------
revoke execute on function
  public.are_friends(uuid, uuid),
  public.find_user_by_username(text),
  public.send_friend_request(uuid),
  public.accept_request(uuid),
  public.decline_request(uuid),
  public.cancel_request(uuid),
  public.unfriend(uuid),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.list_blocked()
from public, anon;

grant execute on function
  public.are_friends(uuid, uuid),
  public.find_user_by_username(text),
  public.send_friend_request(uuid),
  public.accept_request(uuid),
  public.decline_request(uuid),
  public.cancel_request(uuid),
  public.unfriend(uuid),
  public.block_user(uuid),
  public.unblock_user(uuid),
  public.list_blocked()
to authenticated, service_role;
