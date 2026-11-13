-- FROZEN SPEC FILE. Phase 4: plans, RSVPs, tags, hiding. See docs/CONTRACTS.md "Phase 4".
-- Cast: alice creates plans. bob, carol, dave, frank are alice's friends (bob and carol are NOT friends
-- with each other). dave is hidden from the plan. erin is a stranger.
begin;
select plan(52);

-- Structure -------------------------------------------------------------------
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.plans')), false), 'plans exists with RLS');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.plan_rsvps')), false), 'plan_rsvps exists with RLS');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.plan_tags')), false), 'plan_tags exists with RLS');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.plan_hidden_from')), false), 'plan_hidden_from exists with RLS');
select ok(to_regprocedure('public.can_see_plan(uuid)') is not null, 'can_see_plan(uuid) exists');
select ok(to_regprocedure('public.plan_rsvp_counts(uuid)') is not null, 'plan_rsvp_counts(uuid) exists');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'plan_rsvps'),
  'plan_rsvps is published to Realtime');
select ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'plan_tags'),
  'plan_tags is published to Realtime');

-- Fixtures --------------------------------------------------------------------
select tests.create_member('alice');
select tests.create_member('bob');
select tests.create_member('carol');
select tests.create_member('dave');
select tests.create_member('erin');
select tests.create_member('frank');
insert into friendships (requester_id, addressee_id, status) values
  (tests.uid('alice'), tests.uid('bob'), 'accepted'),
  (tests.uid('alice'), tests.uid('carol'), 'accepted'),
  (tests.uid('alice'), tests.uid('dave'), 'accepted'),
  (tests.uid('alice'), tests.uid('frank'), 'accepted');
insert into venues (id, name, address, lat, lng, phone) values
  ('b0000000-0000-0000-0000-000000000001', 'Club One', 'a', 42.0116, 23.0950, '1'),
  ('b0000000-0000-0000-0000-000000000002', 'Club Two', 'b', 42.0200, 23.1000, '2');
insert into events (id, venue_id, performer, starts_at) values
  ('e0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'DJ One', now() + interval '1 day'),
  ('e0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002', 'DJ Two', now() + interval '1 day');

-- alice creates plans ----------------------------------------------------------------
select tests.authenticate_as('alice');
select lives_ok($$ insert into plans (id, creator_id, venue_id, event_id, starts_at)
                   values ('c0000000-0000-0000-0000-000000000001', auth.uid(), 'b0000000-0000-0000-0000-000000000001',
                           'e0000000-0000-0000-0000-000000000001', now() + interval '1 day') $$,
  'a member creates a plan at a venue with an event at that venue');
select lives_ok($$ insert into plans (id, creator_id, venue_id, starts_at)
                   values ('c0000000-0000-0000-0000-000000000002', auth.uid(), 'b0000000-0000-0000-0000-000000000002',
                           now() + interval '2 days') $$,
  'a member creates a plan without an event');
select tests.attempt($$ insert into plans (id, creator_id, venue_id, starts_at)
                        values ('c0000000-0000-0000-0000-000000000003', tests.uid('bob'),
                                'b0000000-0000-0000-0000-000000000001', now()) $$);
select tests.attempt($$ insert into plans (id, creator_id, venue_id, event_id, starts_at)
                        values ('c0000000-0000-0000-0000-000000000004', auth.uid(), 'b0000000-0000-0000-0000-000000000001',
                                'e0000000-0000-0000-0000-000000000002', now()) $$);
select lives_ok($$ insert into plan_hidden_from (plan_id, user_id)
                   values ('c0000000-0000-0000-0000-000000000001', tests.uid('dave')) $$,
  'the creator hides the plan from a friend');
select lives_ok($$ insert into plan_rsvps (plan_id, user_id, status)
                   values ('c0000000-0000-0000-0000-000000000001', auth.uid(), 'going') $$,
  'the creator RSVPs');
select lives_ok($$ insert into plan_tags (plan_id, tagged_user_id, tagged_by)
                   values ('c0000000-0000-0000-0000-000000000001', tests.uid('carol'), auth.uid()) $$,
  'the creator tags a friend (pending)');
select lives_ok($$ insert into plan_tags (plan_id, tagged_user_id, tagged_by)
                   values ('c0000000-0000-0000-0000-000000000001', tests.uid('frank'), auth.uid()) $$,
  'the creator tags another friend (pending)');
select tests.attempt($$ insert into plan_tags (plan_id, tagged_user_id, tagged_by, status)
                        values ('c0000000-0000-0000-0000-000000000001', tests.uid('bob'), auth.uid(), 'accepted') $$);
select tests.attempt($$ insert into plan_tags (plan_id, tagged_user_id, tagged_by)
                        values ('c0000000-0000-0000-0000-000000000001', tests.uid('erin'), auth.uid()) $$);
select tests.attempt($$ insert into plan_tags (plan_id, tagged_user_id, tagged_by)
                        values ('c0000000-0000-0000-0000-000000000001', tests.uid('dave'), auth.uid()) $$);
reset role;
select is((select count(*)::int from plans where id = 'c0000000-0000-0000-0000-000000000003'), 0,
  'nobody can create a plan in someone else''s name');
select is((select count(*)::int from plans where id = 'c0000000-0000-0000-0000-000000000004'), 0,
  'a plan cannot use an event from a different venue');
select is((select count(*)::int from plan_tags where tagged_user_id = tests.uid('bob')), 0,
  'a tag cannot be created already accepted');
select is((select count(*)::int from plan_tags where tagged_user_id = tests.uid('erin')), 0,
  'a non-friend cannot be tagged');
select is((select count(*)::int from plan_tags where tagged_user_id = tests.uid('dave')), 0,
  'a friend the plan is hidden from cannot be tagged');

-- bob: friend of alice, not of carol -------------------------------------------------------
select tests.authenticate_as('bob');
select ok(can_see_plan('c0000000-0000-0000-0000-000000000001'), 'a friend of the creator can see the plan');
select is((select count(*)::int from plans), 2, 'a friend sees the creator''s plans');
select is((select count(*)::int from plan_hidden_from), 0, 'a friend cannot read the hidden-from list');
select is((select count(*)::int from plan_tags), 0, 'pending tags are invisible to other friends');
select lives_ok($$ insert into plan_rsvps (plan_id, user_id, status)
                   values ('c0000000-0000-0000-0000-000000000001', auth.uid(), 'going')
                   on conflict (plan_id, user_id) do update set status = 'going' $$, 'a friend RSVPs going');
select lives_ok($$ insert into plan_rsvps (plan_id, user_id, status)
                   values ('c0000000-0000-0000-0000-000000000001', auth.uid(), 'maybe')
                   on conflict (plan_id, user_id) do update set status = excluded.status $$, 'changing an RSVP is an upsert');
select tests.attempt($$ insert into plan_rsvps (plan_id, user_id, status)
                        values ('c0000000-0000-0000-0000-000000000001', tests.uid('carol'), 'out') $$);
select tests.attempt($$ insert into plan_tags (plan_id, tagged_user_id, tagged_by)
                        values ('c0000000-0000-0000-0000-000000000001', tests.uid('alice'), auth.uid()) $$);
select tests.attempt($$ update plans set starts_at = now() where id = 'c0000000-0000-0000-0000-000000000001' $$);
select tests.attempt($$ delete from plans where id = 'c0000000-0000-0000-0000-000000000002' $$);
select tests.attempt($$ update plan_tags set status = 'accepted' where tagged_user_id = tests.uid('frank') $$);
reset role;
select is((select status::text from plan_rsvps where user_id = tests.uid('bob')), 'maybe', 'the RSVP upsert took effect');
select is((select count(*)::int from plan_rsvps where user_id = tests.uid('carol')), 0, 'nobody can RSVP for someone else');
select is((select count(*)::int from plan_tags where tagged_by = tests.uid('bob')), 0, 'only the creator can tag');
select is((select count(*)::int from plans), 2, 'only the creator can delete a plan');
select ok((select starts_at > now() from plans where id = 'c0000000-0000-0000-0000-000000000001'), 'only the creator can edit a plan');

-- the creator cannot accept a tag on someone's behalf -------------------------------------
select tests.authenticate_as('alice');
select tests.attempt($$ update plan_tags set status = 'accepted' where tagged_user_id = tests.uid('frank') $$);
reset role;
select is((select status::text from plan_tags where tagged_user_id = tests.uid('frank')), 'pending',
  'neither another friend nor the creator can accept a tag for the tagged person');

-- frank declines his tag, carol accepts hers ---------------------------------------------------
select tests.authenticate_as('frank');
select is((select count(*)::int from plan_tags where tagged_user_id = auth.uid()), 1, 'the tagged person sees their pending tag');
select lives_ok($$ delete from plan_tags where tagged_user_id = auth.uid() $$, 'the tagged person can decline (delete) the tag');
select tests.authenticate_as('carol');
select lives_ok($$ insert into plan_rsvps (plan_id, user_id, status)
                   values ('c0000000-0000-0000-0000-000000000001', auth.uid(), 'going') $$, 'carol RSVPs going');
select lives_ok($$ update plan_tags set status = 'accepted' where tagged_user_id = auth.uid() $$, 'the tagged person accepts');
reset role;
select is((select count(*)::int from plan_tags where tagged_user_id = tests.uid('frank')), 0, 'the declined tag is gone');

-- bob again: sees the accepted tag and carol's username, but not carol's RSVP (Q9) ------------
select tests.authenticate_as('bob');
select is((select count(*)::int from plan_tags where status = 'accepted'), 1, 'an accepted tag is visible to friends of the creator');
select is((select count(*)::int from profiles where id = tests.uid('carol')), 1,
  'the username of an accepted-tagged person is readable, even for non-friends');
select is((select count(*)::int from plan_rsvps where user_id = tests.uid('carol')), 0, 'RSVPs of non-friends are not readable');
select is((select count(*)::int from plan_rsvps where user_id in (tests.uid('alice'), tests.uid('bob'))), 2,
  'the creator''s RSVP and your own are readable');
select is((select going_count from plan_rsvp_counts('c0000000-0000-0000-0000-000000000001')), 2,
  'counts include everyone going (alice + carol)');
select is((select maybe_count from plan_rsvp_counts('c0000000-0000-0000-0000-000000000001')), 1, 'counts include maybe (bob)');
reset role;

-- dave: hidden from the plan ---------------------------------------------------------------
select tests.authenticate_as('dave');
select ok(not can_see_plan('c0000000-0000-0000-0000-000000000001'), 'a hidden friend cannot see the plan');
select is((select count(*)::int from plans where id = 'c0000000-0000-0000-0000-000000000001'), 0, 'the hidden plan does not exist for them');
select is((select count(*)::int from plan_rsvp_counts('c0000000-0000-0000-0000-000000000001')), 0, 'counts return no row for a hidden plan');
select tests.attempt($$ insert into plan_rsvps (plan_id, user_id, status)
                        values ('c0000000-0000-0000-0000-000000000001', auth.uid(), 'going') $$);
select is((select count(*)::int from plans where id = 'c0000000-0000-0000-0000-000000000002'), 1,
  'hiding one plan does not hide the creator''s other plans');
reset role;
select is((select count(*)::int from plan_rsvps where user_id = tests.uid('dave')), 0, 'a hidden friend cannot RSVP');

-- erin: stranger -------------------------------------------------------------------------------
select tests.authenticate_as('erin');
select is((select count(*)::int from plans), 0, 'a stranger sees no plans');
select is((select count(*)::int from plan_rsvps), 0, 'a stranger sees no RSVPs');
reset role;

-- blocking hides plans ---------------------------------------------------------------------------
update friendships set status = 'blocked' where addressee_id = tests.uid('bob');
select tests.authenticate_as('bob');
select is((select count(*)::int from plans), 0, 'after a block the plans disappear');
reset role;

-- creator edits and deletes ------------------------------------------------------------------------
select tests.authenticate_as('alice');
select lives_ok($$ delete from plans where id = 'c0000000-0000-0000-0000-000000000001' $$, 'the creator deletes a plan');
reset role;
select is((select count(*)::int from plan_rsvps), 0, 'deleting a plan deletes its RSVPs');

select * from finish();
rollback;
