-- FROZEN SPEC FILE. Phase 6: streaks and stats. See docs/CONTRACTS.md "Phase 6" and BUILD_PLAN Phase 6.
-- "Now" for streaks is fixed with p_as_of = Wednesday 2026-11-18 12:00 Sofia (ISO week Mon 16 - Sun 22 Nov).
begin;
select plan(28);

select ok(to_regprocedure('public.venue_streaks(uuid,timestamp with time zone)') is not null, 'venue_streaks(uuid, timestamptz) exists');
select ok(to_regprocedure('public.user_stats(uuid)') is not null, 'user_stats(uuid) exists');

select tests.create_member('alice');
select tests.create_member('bob');
select tests.create_member('carol');
select tests.create_member('erin');
-- alice is friends with bob and carol. erin is a stranger. bob and carol are friends too.
insert into friendships (requester_id, addressee_id, status) values
  (tests.uid('alice'), tests.uid('bob'), 'accepted'),
  (tests.uid('alice'), tests.uid('carol'), 'accepted'),
  (tests.uid('bob'), tests.uid('carol'), 'accepted');
update profiles set stats_visibility = 'hidden' where id = tests.uid('carol');

insert into venues (id, name, address, lat, lng, phone) values
  ('b0000000-0000-0000-0000-000000000001', 'Club One', 'a', 42.0116, 23.0950, '1'),
  ('b0000000-0000-0000-0000-000000000002', 'Club Two', 'b', 42.0200, 23.1000, '2');

-- Check-in fixtures. created_at is deliberately NOT used for weeks: night_date is.
create temporary table spec_nights (who text, venue uuid, night date, created timestamptz) on commit drop;
insert into spec_nights values
  -- alice @ Club One: Fri 23 Oct, Fri 30 Oct (week after summer time ends), Fri 6 Nov, Fri 13 Nov, Sat 14 Nov (same week)
  ('alice', 'b0000000-0000-0000-0000-000000000001', '2026-10-23', null),
  ('alice', 'b0000000-0000-0000-0000-000000000001', '2026-10-30', null),
  ('alice', 'b0000000-0000-0000-0000-000000000001', '2026-11-06', null),
  ('alice', 'b0000000-0000-0000-0000-000000000001', '2026-11-13', null),
  ('alice', 'b0000000-0000-0000-0000-000000000001', '2026-11-14', null),
  -- alice @ Club Two: weeks of 19 Oct and 2 Nov only, so the week of 9 Nov is empty: streak broken
  ('alice', 'b0000000-0000-0000-0000-000000000002', '2026-10-23', null),
  ('alice', 'b0000000-0000-0000-0000-000000000002', '2026-11-06', null),
  -- bob @ Club One: Fri 30 Oct, Sun 8 Nov, Sun 15 Nov. The Sunday-night check-ins happen after midnight (Monday),
  -- but night_date is Sunday, so they count for the week that just ended.
  ('bob',   'b0000000-0000-0000-0000-000000000001', '2026-10-30', null),
  ('bob',   'b0000000-0000-0000-0000-000000000001', '2026-11-08', '2026-11-09 01:00 Europe/Sofia'),
  ('bob',   'b0000000-0000-0000-0000-000000000001', '2026-11-15', '2026-11-16 01:00 Europe/Sofia'),
  -- carol @ Club One: shares 30 Oct and 13 Nov with alice
  ('carol', 'b0000000-0000-0000-0000-000000000001', '2026-10-30', null),
  ('carol', 'b0000000-0000-0000-0000-000000000001', '2026-11-13', null),
  -- erin (stranger) was there on 30 Oct too: must not appear in alice's top friends
  ('erin',  'b0000000-0000-0000-0000-000000000001', '2026-10-30', null);

insert into checkins (user_id, venue_id, created_at, night_date, distance_m, accuracy_m, photo_path)
select tests.uid(who), venue, coalesce(created, (night + time '23:30') at time zone 'Europe/Sofia'), night, 10, 10, 'x'
from spec_nights;

-- Streaks (owner view) ------------------------------------------------------------
select tests.authenticate_as('alice');
select is((select weeks from venue_streaks(auth.uid(), '2026-11-18 12:00 Europe/Sofia')
           where venue_id = 'b0000000-0000-0000-0000-000000000001'), 4,
  '4 consecutive weeks; two nights in one week count once; the empty current week does not break it');
select is((select weeks from venue_streaks(auth.uid(), '2026-11-18 12:00 Europe/Sofia')
           where venue_id = 'b0000000-0000-0000-0000-000000000002'), 0,
  'a whole missed week breaks the streak');
select is((select count(*)::int from venue_streaks(auth.uid(), '2026-11-18 12:00 Europe/Sofia')), 2,
  'one row per venue the user has checked in at');
select is((select weeks from venue_streaks(auth.uid(), '2026-11-22 23:59 Europe/Sofia')
           where venue_id = 'b0000000-0000-0000-0000-000000000001'), 4,
  'the streak is still alive on the last minute of the current week');
select is((select weeks from venue_streaks(auth.uid(), '2026-11-23 00:30 Europe/Sofia')
           where venue_id = 'b0000000-0000-0000-0000-000000000001'), 0,
  'once a whole week has passed with no check-in, the streak resets');

-- Stats (owner view) --------------------------------------------------------------
select is((user_stats(auth.uid()) ->> 'nights_out')::int, 5, 'nights out = distinct nights at any venue');
select is((user_stats(auth.uid()) -> 'top_venues' -> 0 ->> 'venue_id')::uuid, 'b0000000-0000-0000-0000-000000000001'::uuid,
  'top venue is the one with the most nights');
select is((user_stats(auth.uid()) -> 'top_venues' -> 0 ->> 'nights')::int, 5, 'top venue night count');
select is(jsonb_array_length(user_stats(auth.uid()) -> 'top_friends'), 2, 'top friends lists only current friends who shared a night');
select is((user_stats(auth.uid()) -> 'top_friends' -> 0 ->> 'user_id')::uuid, tests.uid('carol'),
  'the friend with the most shared nights comes first');
select is((user_stats(auth.uid()) -> 'top_friends' -> 0 ->> 'nights')::int, 2, 'carol shared 2 nights at the same venue');
select is((user_stats(auth.uid()) -> 'top_friends' -> 1 ->> 'nights')::int, 1, 'bob shared 1 night');
reset role;

-- Sunday night after midnight counts for the week that just ended ------------------------------
select tests.authenticate_as('bob');
select is((select weeks from venue_streaks(auth.uid(), '2026-11-18 12:00 Europe/Sofia')), 3,
  'weeks come from night_date, not from the time of the check-in');
reset role;

-- A check-in in the current week extends the streak ----------------------------------------------
insert into checkins (user_id, venue_id, created_at, night_date, distance_m, accuracy_m, photo_path)
values (tests.uid('alice'), 'b0000000-0000-0000-0000-000000000001', '2026-11-16 23:30 Europe/Sofia', '2026-11-16', 10, 10, 'x');
select tests.authenticate_as('alice');
select is((select weeks from venue_streaks(auth.uid(), '2026-11-18 12:00 Europe/Sofia')
           where venue_id = 'b0000000-0000-0000-0000-000000000001'), 5, 'a check-in this week makes it 5');
select is((user_stats(auth.uid()) ->> 'nights_out')::int, 6, 'and adds a night out');
reset role;

-- Visibility (Q19) --------------------------------------------------------------------------
select tests.authenticate_as('bob');
select is((select count(*)::int from venue_streaks(tests.uid('alice'), '2026-11-18 12:00 Europe/Sofia')), 2,
  'a friend sees streaks when stats are visible to friends');
select ok(user_stats(tests.uid('alice')) is not null, 'a friend sees stats when visible to friends');
select is((select count(*)::int from venue_streaks(tests.uid('carol'), '2026-11-18 12:00 Europe/Sofia')), 0,
  'a friend sees no streaks when the owner hid them');
select ok(user_stats(tests.uid('carol')) is null, 'a friend gets null stats when the owner hid them');
reset role;

select tests.authenticate_as('carol');
select ok(user_stats(auth.uid()) is not null, 'the owner always sees their own stats, even when hidden');
select is((select count(*)::int from venue_streaks(auth.uid(), '2026-11-18 12:00 Europe/Sofia')), 1,
  'the owner always sees their own streaks, even when hidden');
reset role;

select tests.authenticate_as('erin');
select is((select count(*)::int from venue_streaks(tests.uid('alice'), '2026-11-18 12:00 Europe/Sofia')), 0,
  'a stranger sees no streaks');
select ok(user_stats(tests.uid('alice')) is null, 'a stranger gets null stats');
reset role;

select tests.authenticate_as('alice');
select lives_ok($$ update profiles set stats_visibility = 'hidden' where id = auth.uid() $$, 'the owner can hide their stats');
select tests.authenticate_as('bob');
select ok(user_stats(tests.uid('alice')) is null, 'after hiding, the friend gets null stats');
select is((select count(*)::int from venue_streaks(tests.uid('alice'), '2026-11-18 12:00 Europe/Sofia')), 0,
  'after hiding, the friend sees no streaks');
reset role;

select * from finish();
rollback;
