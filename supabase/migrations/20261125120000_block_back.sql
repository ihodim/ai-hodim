-- Phase 2 spec change: blocking back. Contract: docs/CONTRACTS.md "Phase 2". Spec: supabase/tests/database/020-*.
-- Before: block_user replaced any row, so a blocked user could block back (taking over the row) and then unblock,
-- lifting the original block. Now both blocks live on the pair's one row (mutual_block), each block lasts until
-- its own blocker lifts it, and no client can read a blocked row at all, so nobody can tell whose block came first
-- (Q12). A user's own blocks come from list_blocked().

alter table public.friendships
  add column mutual_block boolean not null default false,
  add constraint friendships_mutual_only_blocked check (not mutual_block or status = 'blocked');

comment on column public.friendships.mutual_block is
  'For a blocked row: the addressee has blocked back. requester_id is the user whose block came first.';

-- Read rule: parties see pending and accepted rows only. Blocked rows are invisible to every client.
drop policy friendships_select_party on public.friendships;
create policy friendships_select_party on public.friendships
  for select to authenticated
  using (status <> 'blocked' and (select auth.uid()) in (requester_id, addressee_id));

-- One transaction-scoped lock per pair, so concurrent requests and blocks on the same two users run one at a time
-- (without it, two users blocking each other at once could both insert and one would fail on the pair index).
create function public.lock_friendship_pair(a uuid, b uuid)
returns void
language sql
volatile
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended(least(a, b)::text || greatest(a, b)::text, 0));
$$;

revoke execute on function public.lock_friendship_pair(uuid, uuid) from public, anon, authenticated;

create or replace function public.send_friend_request(p_addressee uuid)
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

  perform public.lock_friendship_pair(v_me, p_addressee);
  insert into public.friendships (requester_id, addressee_id, status)
  values (v_me, p_addressee, 'pending');
exception
  -- Any existing row for the pair (pending, accepted or blocked, either direction) hits the pair index. Same message
  -- in every case, so a blocked user can't tell (Q12).
  when unique_violation then
    raise exception 'request_not_allowed' using errcode = 'P0001';
end;
$$;

create or replace function public.block_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_row public.friendships;
begin
  if v_me is null or not public.is_member() then
    raise exception 'not_member' using errcode = 'P0001';
  end if;
  if p_target is null or p_target = v_me or not exists (select 1 from public.profiles where id = p_target) then
    raise exception 'block_not_allowed' using errcode = 'P0001';
  end if;

  perform public.lock_friendship_pair(v_me, p_target);
  select * into v_row
  from public.friendships
  where (requester_id = v_me and addressee_id = p_target) or (requester_id = p_target and addressee_id = v_me);

  if found and v_row.status = 'blocked' then
    -- The target blocked first: keep their block and record ours next to it. If we already block, nothing changes.
    if v_row.requester_id = p_target then
      update public.friendships
      set mutual_block = true, updated_at = now()
      where requester_id = p_target and addressee_id = v_me;
    end if;
    return;
  end if;

  -- A pending or accepted row ends here; blocking ends a friendship.
  delete from public.friendships
  where (requester_id = v_me and addressee_id = p_target) or (requester_id = p_target and addressee_id = v_me);
  insert into public.friendships (requester_id, addressee_id, status)
  values (v_me, p_target, 'blocked');
end;
$$;

create or replace function public.unblock_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := (select auth.uid());
  v_row public.friendships;
begin
  if v_me is not null and p_target is not null then
    perform public.lock_friendship_pair(v_me, p_target);
    select * into v_row
    from public.friendships
    where status = 'blocked'
      and ((requester_id = v_me and addressee_id = p_target) or (requester_id = p_target and addressee_id = v_me));

    if found then
      if v_row.requester_id = v_me and not v_row.mutual_block then
        -- Only our block: the row goes.
        delete from public.friendships where requester_id = v_me and addressee_id = p_target;
        return;
      elsif v_row.requester_id = v_me then
        -- We blocked first and they blocked back: their block stays as a one-way block (one UPDATE swaps the pair).
        update public.friendships
        set requester_id = p_target, addressee_id = v_me, mutual_block = false, updated_at = now()
        where requester_id = v_me and addressee_id = p_target;
        return;
      elsif v_row.mutual_block then
        -- They blocked first and we blocked back: lift only ours.
        update public.friendships
        set mutual_block = false, updated_at = now()
        where requester_id = p_target and addressee_id = v_me;
        return;
      end if;
    end if;
  end if;

  -- No block of ours: the same answer whether or not the target blocks us (Q12).
  raise exception 'not_blocked' using errcode = 'P0001';
end;
$$;

-- The caller's own blocks, including one where the caller blocked back.
create or replace function public.list_blocked()
returns table (id uuid, username extensions.citext)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.username
  from public.friendships f
  join public.profiles p
    on p.id = case when f.requester_id = (select auth.uid()) then f.addressee_id else f.requester_id end
  where f.status = 'blocked'
    and (
      f.requester_id = (select auth.uid())
      or (f.addressee_id = (select auth.uid()) and f.mutual_block)
    )
  order by p.username;
$$;
