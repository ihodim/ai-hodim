-- FROZEN SPEC FILE. Phase 5: check-ins, the night rule and photo access. See docs/CONTRACTS.md "Phase 5".
begin;
select plan(30);

-- Structure -------------------------------------------------------------------
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.checkins')), false), 'checkins exists with RLS');
select ok(to_regprocedure('public.checkin_night(uuid,timestamp with time zone)') is not null, 'checkin_night(uuid, timestamptz) exists');
select is((select public from storage.buckets where id = 'checkin-photos'), false, 'the checkin-photos bucket exists and is private');

-- Venues: V1 22:00-04:00 (crosses midnight), V3 20:00-23:30 (does not) ----------------------
insert into venues (id, name, address, lat, lng, phone, checkin_window_start, checkin_window_end) values
  ('b0000000-0000-0000-0000-000000000001', 'Club One', 'a', 42.0116, 23.0950, '1', '22:00', '04:00'),
  ('b0000000-0000-0000-0000-000000000003', 'Bar Three', 'c', 42.0150, 23.0990, '3', '20:00', '23:30');

-- The night rule (Q14, Q16). All literals are Sofia local time unless marked +00. -------------------
select is(checkin_night('b0000000-0000-0000-0000-000000000001', '2026-11-13 23:00 Europe/Sofia'), '2026-11-13'::date,
  'Friday 23:00 belongs to Friday night');
select is(checkin_night('b0000000-0000-0000-0000-000000000001', '2026-11-14 01:30 Europe/Sofia'), '2026-11-13'::date,
  'Saturday 01:30 belongs to Friday night');
select is(checkin_night('b0000000-0000-0000-0000-000000000001', '2026-11-13 22:00 Europe/Sofia'), '2026-11-13'::date,
  'the window start is inclusive');
select is(checkin_night('b0000000-0000-0000-0000-000000000001', '2026-11-14 03:59 Europe/Sofia'), '2026-11-13'::date,
  'one minute before the end is still inside');
select is(checkin_night('b0000000-0000-0000-0000-000000000001', '2026-11-14 04:00 Europe/Sofia'), null::date,
  'the window end is exclusive');
select is(checkin_night('b0000000-0000-0000-0000-000000000001', '2026-11-13 18:00 Europe/Sofia'), null::date,
  '18:00 is outside a 22:00-04:00 window');
select is(checkin_night('b0000000-0000-0000-0000-000000000001', '2026-11-13 21:30+00'), '2026-11-13'::date,
  'UTC input is converted to Sofia time (21:30 UTC = 23:30 Sofia)');
select is(checkin_night('b0000000-0000-0000-0000-000000000001', '2026-11-13 22:30+00'), '2026-11-13'::date,
  '22:30 UTC = 00:30 Sofia on Saturday, still Friday night');
select is(checkin_night('b0000000-0000-0000-0000-000000000003', '2026-11-13 21:00 Europe/Sofia'), '2026-11-13'::date,
  'a window that does not cross midnight uses the same date');
select is(checkin_night('b0000000-0000-0000-0000-000000000003', '2026-11-13 23:45 Europe/Sofia'), null::date,
  'after a 23:30 end is outside');
select is(checkin_night('b0000000-0000-0000-0000-000000000001', '2026-10-25 01:30 Europe/Sofia'), '2026-10-24'::date,
  'the night summer time ends still maps to Saturday');
select is(checkin_night('b0000000-0000-0000-0000-000000000001', '2027-03-28 02:30+02'), '2027-03-27'::date,
  'the night summer time starts still maps to Saturday');

-- Fixtures --------------------------------------------------------------------
select tests.create_member('alice');
select tests.create_member('bob');
select tests.create_member('erin');
select tests.create_member('admin1', '1995-05-05', true);
insert into friendships (requester_id, addressee_id, status) values (tests.uid('alice'), tests.uid('bob'), 'accepted');
insert into checkins (id, user_id, venue_id, created_at, night_date, distance_m, accuracy_m, photo_path) values
  ('d0000000-0000-0000-0000-000000000001', tests.uid('alice'), 'b0000000-0000-0000-0000-000000000001',
   now() - interval '1 hour', current_date, 12, 15, tests.uid('alice') || '/d0000000-0000-0000-0000-000000000001.jpg'),
  ('d0000000-0000-0000-0000-000000000002', tests.uid('alice'), 'b0000000-0000-0000-0000-000000000001',
   now() - interval '2 days', current_date - 2, 20, 30, tests.uid('alice') || '/d0000000-0000-0000-0000-000000000002.jpg');
insert into storage.objects (bucket_id, name) values
  ('checkin-photos', tests.uid('alice') || '/d0000000-0000-0000-0000-000000000001.jpg'),
  ('checkin-photos', tests.uid('alice') || '/d0000000-0000-0000-0000-000000000002.jpg');

select throws_ok(
  format($$ insert into checkins (user_id, venue_id, night_date, distance_m, accuracy_m, photo_path)
            values (%L, 'b0000000-0000-0000-0000-000000000001', current_date, 1, 1, 'x') $$, tests.uid('alice')),
  '23505', null, 'only one check-in per venue per night (Q15)');

-- Row access ------------------------------------------------------------------
select tests.authenticate_as('alice');
select is((select count(*)::int from checkins), 2, 'the owner reads their check-ins');
select is((select count(*)::int from storage.objects where bucket_id = 'checkin-photos'), 2,
  'the owner reads all their photos, including old ones');
select tests.attempt($$ insert into checkins (user_id, venue_id, night_date, distance_m, accuracy_m, photo_path)
                        values (auth.uid(), 'b0000000-0000-0000-0000-000000000003', current_date, 0, 5, 'x') $$);
select tests.attempt($$ update checkins set night_date = current_date - 7 where user_id = auth.uid() $$);
select tests.attempt($$ delete from checkins where user_id = auth.uid() $$);
select tests.attempt(format($$ insert into storage.objects (bucket_id, name) values ('checkin-photos', '%s/fake.jpg') $$, tests.uid('alice')));
reset role;
select is((select count(*)::int from checkins where user_id = tests.uid('alice')), 2,
  'clients cannot insert or delete check-ins (only the Edge Function can)');
select is((select count(*)::int from checkins where night_date = current_date - 7), 0, 'clients cannot edit check-ins');
select is((select count(*)::int from storage.objects where name like '%/fake.jpg'), 0, 'clients cannot upload photos');

select tests.authenticate_as('bob');
select is((select count(*)::int from checkins where user_id = tests.uid('alice')), 2, 'a friend reads the check-ins');
select is((select count(*)::int from storage.objects where bucket_id = 'checkin-photos'), 1,
  'a friend sees only photos from the last 24 hours');
select is((select name from storage.objects where bucket_id = 'checkin-photos'),
  tests.uid('alice') || '/d0000000-0000-0000-0000-000000000001.jpg', 'and it is the recent one');
reset role;

select tests.authenticate_as('erin');
select is((select count(*)::int from checkins), 0, 'a stranger reads no check-ins');
select is((select count(*)::int from storage.objects where bucket_id = 'checkin-photos'), 0, 'a stranger sees no photos');
reset role;

-- Block hides check-ins --------------------------------------------------------------------
update friendships set status = 'blocked' where addressee_id = tests.uid('bob');
select tests.authenticate_as('bob');
select is((select count(*)::int from checkins), 0, 'after a block the check-ins disappear');
select is((select count(*)::int from storage.objects where bucket_id = 'checkin-photos'), 0, 'after a block the photos disappear');
reset role;

-- Admin can delete a check-in (Q20) --------------------------------------------------------
select tests.authenticate_as('admin1');
select lives_ok($$ delete from checkins where id = 'd0000000-0000-0000-0000-000000000002' $$, 'an admin can delete a check-in');
reset role;
select is((select count(*)::int from checkins where id = 'd0000000-0000-0000-0000-000000000002'), 0, 'the admin delete took effect');

select * from finish();
rollback;
