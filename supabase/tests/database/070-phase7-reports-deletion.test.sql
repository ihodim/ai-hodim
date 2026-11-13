-- FROZEN SPEC FILE. Phase 7: reports and account deletion (database part). See docs/CONTRACTS.md "Phase 7".
begin;
select plan(25);

select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.reports')), false), 'reports exists with RLS');

select tests.create_member('alice');
select tests.create_member('bob');
select tests.create_member('erin');
select tests.create_member('admin1', '1995-05-05', true);
insert into friendships (requester_id, addressee_id, status) values (tests.uid('alice'), tests.uid('bob'), 'accepted');
insert into venues (id, name, address, lat, lng, phone) values
  ('b0000000-0000-0000-0000-000000000001', 'Club One', 'a', 42.0116, 23.0950, '1');
insert into checkins (id, user_id, venue_id, night_date, distance_m, accuracy_m, photo_path) values
  ('d0000000-0000-0000-0000-000000000001', tests.uid('bob'), 'b0000000-0000-0000-0000-000000000001', current_date, 5, 5, 'x');

-- Reporting ---------------------------------------------------------------------
select tests.authenticate_as('alice');
select lives_ok(format($$ insert into reports (reporter_id, target_user_id, reason) values (auth.uid(), %L, 'harassment') $$,
  tests.uid('bob')), 'a member reports a user they can see');
select lives_ok($$ insert into reports (reporter_id, target_checkin_id, reason)
                   values (auth.uid(), 'd0000000-0000-0000-0000-000000000001', 'inappropriate') $$,
  'a member reports a check-in photo they can see');
select tests.attempt(format($$ insert into reports (reporter_id, target_user_id, reason) values (%L, %L, 'other') $$,
  tests.uid('bob'), tests.uid('erin')));
select tests.attempt(format($$ insert into reports (reporter_id, target_user_id, reason) values (auth.uid(), %L, 'spam') $$,
  tests.uid('bob')));
select is((select count(*)::int from reports), 2, 'the reporter reads their own reports');
select tests.attempt($$ update reports set status = 'reviewed' $$);
reset role;
select is((select count(*)::int from reports where reporter_id = tests.uid('bob')), 0, 'nobody can report in someone else''s name');
select is((select count(*)::int from reports where reporter_id = tests.uid('alice')), 2, 'a report with an undefined reason is rejected (Q20)');
select is((select count(*)::int from reports where status = 'reviewed'), 0, 'a member cannot mark reports reviewed');

select throws_ok(format($$ insert into reports (reporter_id, target_user_id, target_checkin_id, reason)
                          values (%L, %L, 'd0000000-0000-0000-0000-000000000001', 'other') $$,
                        tests.uid('alice'), tests.uid('bob')),
  '23514', null, 'a report cannot have two targets');
select throws_ok(format($$ insert into reports (reporter_id, reason) values (%L, 'other') $$, tests.uid('alice')),
  '23514', null, 'a report must have a target');

select tests.authenticate_as('erin');
select tests.attempt(format($$ insert into reports (reporter_id, target_user_id, reason) values (auth.uid(), %L, 'harassment') $$,
  tests.uid('bob')));
select tests.attempt($$ insert into reports (reporter_id, target_checkin_id, reason)
                        values (auth.uid(), 'd0000000-0000-0000-0000-000000000001', 'inappropriate') $$);
reset role;
select is((select count(*)::int from reports where reporter_id = tests.uid('erin')), 0,
  'a stranger cannot report a user or photo they cannot see');

select tests.authenticate_as('bob');
select is((select count(*)::int from reports), 0, 'the reported person cannot read reports about them');
reset role;

select tests.authenticate_as('admin1');
select is((select count(*)::int from reports), 2, 'an admin reads all reports');
select lives_ok($$ update reports set status = 'reviewed', reviewed_at = now(), reviewed_by = auth.uid()
                   where target_user_id is not null $$, 'an admin marks a report reviewed');
reset role;
select is((select count(*)::int from reports where status = 'reviewed'), 1, 'the review took effect');

-- Account deletion cascades (database part of delete-account) ----------------------------------
insert into reports (reporter_id, target_user_id, reason) values (tests.uid('bob'), tests.uid('alice'), 'other');
insert into plans (id, creator_id, venue_id, starts_at) values
  ('c0000000-0000-0000-0000-000000000001', tests.uid('alice'), 'b0000000-0000-0000-0000-000000000001', now() + interval '1 day'),
  ('c0000000-0000-0000-0000-000000000002', tests.uid('bob'),   'b0000000-0000-0000-0000-000000000001', now() + interval '1 day');
insert into plan_rsvps (plan_id, user_id, status) values ('c0000000-0000-0000-0000-000000000001', tests.uid('bob'), 'going');
insert into plan_tags (plan_id, tagged_user_id, tagged_by, status)
  values ('c0000000-0000-0000-0000-000000000001', tests.uid('bob'), tests.uid('alice'), 'accepted');
insert into plan_tags (plan_id, tagged_user_id, tagged_by, status)
  values ('c0000000-0000-0000-0000-000000000002', tests.uid('alice'), tests.uid('bob'), 'pending');
insert into plan_hidden_from (plan_id, user_id) values ('c0000000-0000-0000-0000-000000000001', tests.uid('bob'));

delete from auth.users where id = tests.uid('bob');

select is((select count(*)::int from profiles where id = tests.uid('bob')), 0, 'deleted: no profile');
select ok(not exists (select 1 from profiles where username = 'bob'), 'deleted: username is free again');
select is((select count(*)::int from profile_private where user_id not in (select id from profiles)), 0, 'deleted: no date of birth left');
select is((select count(*)::int from friendships where requester_id not in (select id from profiles)
                                                  or addressee_id not in (select id from profiles)), 0, 'deleted: no friendships left');
select is((select count(*)::int from plans where id = 'c0000000-0000-0000-0000-000000000002'), 0, 'deleted: their plans are gone');
select is((select count(*)::int from plan_rsvps where plan_id = 'c0000000-0000-0000-0000-000000000001'), 0, 'deleted: their RSVPs are gone');
select is((select count(*)::int from plan_tags), 0, 'deleted: tags of and by them are gone');
select is((select count(*)::int from plan_hidden_from), 0, 'deleted: hidden-from rows are gone');
select is((select count(*)::int from checkins where id = 'd0000000-0000-0000-0000-000000000001'), 0, 'deleted: their check-ins are gone');
select is((select count(*)::int from reports where reason in ('harassment', 'inappropriate')), 0,
  'deleted: reports about them and their photos are gone');
select is((select count(*)::int from reports where reporter_id is null and target_user_id = (select id from profiles where username = 'alice')), 1,
  'deleted: their own reports stay, with the reporter set to null');

select * from finish();
rollback;
