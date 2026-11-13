-- FROZEN SPEC FILE. Phase 3: venues and events. See docs/CONTRACTS.md "Phase 3".
begin;
select plan(18);

select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.venues')), false),
  'venues exists and has RLS enabled');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.events')), false),
  'events exists and has RLS enabled');

select tests.create_member('admin1', '1995-05-05', true);
select tests.create_member('alice');
select tests.create_user('ghost');

-- Admin writes ------------------------------------------------------------------
select tests.authenticate_as('admin1');
select lives_ok($$ insert into venues (id, name, address, lat, lng, phone)
                   values ('a0000000-0000-0000-0000-000000000001', 'Club One', 'ul. Test 1, Blagoevgrad',
                           42.0116, 23.0950, '+359888000001') $$,
  'an admin can create a venue');
select lives_ok($$ insert into events (id, venue_id, performer, starts_at, promo)
                   values ('e0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001',
                           'DJ Test', now() + interval '2 days', '2 for 1 until midnight') $$,
  'an admin can create an event');
select lives_ok($$ update venues set phone = '+359888000002' where id = 'a0000000-0000-0000-0000-000000000001' $$,
  'an admin can edit a venue');
reset role;

select is((select checkin_radius_m from venues where id = 'a0000000-0000-0000-0000-000000000001'), 100,
  'check-in radius defaults to 100 m');
select is((select checkin_window_start from venues where id = 'a0000000-0000-0000-0000-000000000001'), '22:00'::time,
  'check-in window starts at 22:00 by default');
select is((select checkin_window_end from venues where id = 'a0000000-0000-0000-0000-000000000001'), '04:00'::time,
  'check-in window ends at 04:00 by default');
select throws_ok($$ insert into venues (name, address, lat, lng, phone, checkin_radius_m)
                    values ('Bad', 'x', 42, 23, '1', 0) $$,
  '23514', null, 'a radius of 0 is rejected');

-- Member reads, cannot write --------------------------------------------------------
select tests.authenticate_as('alice');
select is((select count(*)::int from venues), 1, 'a member reads venues');
select is((select count(*)::int from events), 1, 'a member reads events');
select tests.attempt($$ insert into venues (name, address, lat, lng, phone) values ('Fake', 'x', 42, 23, '1') $$);
select tests.attempt($$ update venues set name = 'Hacked' where id = 'a0000000-0000-0000-0000-000000000001' $$);
select tests.attempt($$ delete from venues where id = 'a0000000-0000-0000-0000-000000000001' $$);
select tests.attempt($$ insert into events (venue_id, performer, starts_at)
                        values ('a0000000-0000-0000-0000-000000000001', 'Fake DJ', now()) $$);
reset role;
select is((select count(*)::int from venues), 1, 'a member cannot create venues');
select is((select name from venues where id = 'a0000000-0000-0000-0000-000000000001'), 'Club One', 'a member cannot edit venues');
select is((select count(*)::int from events), 1, 'a member cannot create events');

-- Non-members and anon read nothing ---------------------------------------------------
select tests.authenticate_as('ghost');
select is((select count(*)::int from venues), 0, 'a signed-in non-member reads no venues');
select is((select count(*)::int from events), 0, 'a signed-in non-member reads no events');
reset role;
select tests.as_anon();
select is((select count(*)::int from venues), 0, 'signed-out clients read no venues');
reset role;

-- Cascade -----------------------------------------------------------------------------
delete from venues where id = 'a0000000-0000-0000-0000-000000000001';
select is((select count(*)::int from events), 0, 'deleting a venue deletes its events');

select * from finish();
rollback;
