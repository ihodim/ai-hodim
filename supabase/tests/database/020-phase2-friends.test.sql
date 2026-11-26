-- FROZEN SPEC FILE. Phase 2: friends and blocking. See docs/CONTRACTS.md "Phase 2".
begin;
select plan(74);

-- Structure -------------------------------------------------------------------
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.friendships')), false),
  'friendships exists and has RLS enabled');
select ok(to_regprocedure('public.are_friends(uuid,uuid)') is not null, 'are_friends(uuid,uuid) exists');
select ok(to_regprocedure('public.find_user_by_username(text)') is not null, 'find_user_by_username(text) exists');
select ok(to_regprocedure('public.send_friend_request(uuid)') is not null, 'send_friend_request(uuid) exists');
select ok(to_regprocedure('public.accept_request(uuid)') is not null, 'accept_request(uuid) exists');
select ok(to_regprocedure('public.decline_request(uuid)') is not null, 'decline_request(uuid) exists');
select ok(to_regprocedure('public.unfriend(uuid)') is not null, 'unfriend(uuid) exists');
select ok(to_regprocedure('public.block_user(uuid)') is not null, 'block_user(uuid) exists');
select ok(to_regprocedure('public.unblock_user(uuid)') is not null, 'unblock_user(uuid) exists');

-- Fixtures --------------------------------------------------------------------
select tests.create_member('alice');
select tests.create_member('bob');
select tests.create_member('carol');
select tests.create_member('dave');
select tests.create_user('ghost');

-- Search ----------------------------------------------------------------------
select tests.authenticate_as('alice');
select is((select count(*)::int from find_user_by_username('bob')), 1, 'exact username finds the user');
select is((select id from find_user_by_username('BOB')), tests.uid('bob'), 'search is case-insensitive and returns the right id');
select is((select count(*)::int from find_user_by_username('bo')), 0, 'partial username finds nobody');

-- Requests --------------------------------------------------------------------
select tests.attempt($$ insert into friendships (requester_id, addressee_id, status)
                        values (auth.uid(), tests.uid('bob'), 'accepted') $$);
reset role;
select is((select count(*)::int from friendships), 0, 'clients cannot insert friendship rows directly');

select tests.authenticate_as('alice');
select lives_ok($$ select send_friend_request(tests.uid('bob')) $$, 'alice sends bob a request');
select throws_ok($$ select send_friend_request(tests.uid('bob')) $$, 'P0001', null, 'a duplicate request fails');
select throws_ok($$ select accept_request(tests.uid('bob')) $$, 'P0001', null, 'alice cannot accept her own request');
select is((select count(*)::int from friendships where status = 'pending'), 1, 'requester sees the pending row');
select tests.attempt($$ select send_friend_request(auth.uid()) $$);
reset role;
select is((select status::text from friendships
           where requester_id = tests.uid('alice') and addressee_id = tests.uid('bob')), 'pending',
  'request is still pending after alice tried to accept it herself');
select is((select count(*)::int from friendships where requester_id = addressee_id), 0, 'nobody can befriend themselves');

select tests.authenticate_as('bob');
select is((select count(*)::int from friendships where status = 'pending'), 1, 'addressee sees the pending row');
select throws_ok($$ select send_friend_request(tests.uid('alice')) $$, 'P0001', null,
  'a counter-request fails while one is pending');
select is((select count(*)::int from profiles where id = tests.uid('alice')), 1, 'a pending request makes the profile readable');
select lives_ok($$ select accept_request(tests.uid('alice')) $$, 'bob accepts');
select is((select count(*)::int from profile_private where user_id = tests.uid('alice')), 0,
  'friends still cannot read each other''s date of birth');
reset role;
select ok(are_friends(tests.uid('alice'), tests.uid('bob')) and are_friends(tests.uid('bob'), tests.uid('alice')),
  'are_friends is true in both directions after accepting');

select tests.authenticate_as('carol');
select is((select count(*)::int from friendships), 0, 'a third person cannot see other people''s friendships');
reset role;

-- Decline and re-send (Q12) -----------------------------------------------------
select tests.authenticate_as('alice');
select lives_ok($$ select send_friend_request(tests.uid('carol')) $$, 'alice sends carol a request');
select tests.authenticate_as('bob');
select throws_ok($$ select accept_request(tests.uid('alice')) $$, 'P0001', null,
  'bob cannot accept a request that was sent to carol');
select tests.authenticate_as('carol');
select lives_ok($$ select decline_request(tests.uid('alice')) $$, 'carol declines');
reset role;
select is((select count(*)::int from friendships where tests.uid('carol') in (requester_id, addressee_id)), 0,
  'declining removes the row');
select tests.authenticate_as('alice');
select lives_ok($$ select send_friend_request(tests.uid('carol')) $$, 'a declined request can be re-sent straight away');
reset role;
select ok(not are_friends(tests.uid('alice'), tests.uid('carol')), 'a pending request is not a friendship');

-- Unfriend ----------------------------------------------------------------------
select tests.authenticate_as('bob');
select lives_ok($$ select unfriend(tests.uid('alice')) $$, 'bob unfriends alice');
reset role;
select ok(not are_friends(tests.uid('alice'), tests.uid('bob')), 'unfriending ends the friendship for both');

-- Blocking ----------------------------------------------------------------------
insert into friendships (requester_id, addressee_id, status) values (tests.uid('alice'), tests.uid('bob'), 'accepted');
select tests.authenticate_as('alice');
select lives_ok($$ select block_user(tests.uid('bob')) $$, 'alice blocks her friend bob');
select is((select count(*)::int from find_user_by_username('bob')), 0, 'the blocker cannot find the blocked user');
select is((select count(*)::int from friendships where status = 'blocked'), 0, 'not even the blocker sees a block row');
select is((select array_agg(username::text) from list_blocked()), array['bob'], 'the blocker sees the block in list_blocked');
reset role;
select ok(not are_friends(tests.uid('alice'), tests.uid('bob')), 'blocking ends the friendship');

select tests.authenticate_as('bob');
select is((select count(*)::int from find_user_by_username('alice')), 0, 'the blocked user cannot find the blocker');
select throws_ok($$ select send_friend_request(tests.uid('alice')) $$, 'P0001', null,
  'the blocked user cannot send a request');
select is((select count(*)::int from friendships), 0, 'the blocked user cannot see the block row');
select is((select count(*)::int from profiles where id = tests.uid('alice')), 0, 'the blocked user cannot read the blocker''s profile');
select tests.attempt($$ select unblock_user(tests.uid('alice')) $$);
reset role;
select is((select status::text from friendships where requester_id = tests.uid('alice') and addressee_id = tests.uid('bob')),
  'blocked', 'the blocked user cannot lift the block');

select tests.authenticate_as('alice');
select lives_ok($$ select unblock_user(tests.uid('bob')) $$, 'the blocker can unblock');
reset role;
select is((select count(*)::int from friendships where tests.uid('bob') in (requester_id, addressee_id)), 0,
  'unblocking removes the row');

-- A non-member cannot send requests ------------------------------------------------
select tests.authenticate_as('ghost');
select tests.attempt($$ select send_friend_request(tests.uid('dave')) $$);
reset role;
select is((select count(*)::int from friendships where tests.uid('dave') in (requester_id, addressee_id)), 0,
  'a signed-in user without a profile cannot send requests');

-- Blocking back (both users block each other) ---------------------------------------
-- A block lasts until its own blocker lifts it. Blocking back must not hand the first block over to the other
-- user, and neither user may be able to tell whose block came first (Q12).

-- A) the blocked user blocks back, then unblocks: the first block stays.
select tests.authenticate_as('alice');
select lives_ok($$ select block_user(tests.uid('dave')) $$, 'alice blocks dave');
select tests.authenticate_as('dave');
select lives_ok($$ select block_user(tests.uid('alice')) $$, 'dave blocks alice back');
select is((select count(*)::int from friendships), 0, 'after blocking back dave sees no friendship rows');
select is((select array_agg(username::text) from list_blocked()), array['alice'],
  'dave''s list_blocked shows alice, as for any block');
select lives_ok($$ select unblock_user(tests.uid('alice')) $$, 'dave lifts his own block');
reset role;
select is((select count(*)::int from friendships
           where requester_id = tests.uid('alice') and addressee_id = tests.uid('dave')
             and status = 'blocked' and not mutual_block), 1,
  'alice''s block survives dave blocking back and unblocking');
select tests.authenticate_as('dave');
select is((select count(*)::int from find_user_by_username('alice')), 0, 'dave still cannot find alice');
select throws_ok($$ select send_friend_request(tests.uid('alice')) $$, 'P0001', null,
  'dave still cannot send alice a request');
select tests.authenticate_as('alice');
select lives_ok($$ select unblock_user(tests.uid('dave')) $$, 'alice lifts her block');
reset role;
select is((select count(*)::int from friendships where tests.uid('dave') in (requester_id, addressee_id)), 0,
  'with no block left the row is gone');

-- B) the first blocker unblocks: the second block stays.
select tests.authenticate_as('alice');
select lives_ok($$ select block_user(tests.uid('dave')) $$, 'alice blocks dave again');
select tests.authenticate_as('dave');
select lives_ok($$ select block_user(tests.uid('alice')) $$, 'dave blocks alice back again');
select tests.authenticate_as('alice');
select is((select count(*)::int from friendships where tests.uid('dave') in (requester_id, addressee_id)), 0,
  'alice sees no row for the pair either');
select lives_ok($$ select unblock_user(tests.uid('dave')) $$, 'alice lifts her block first');
reset role;
select is((select count(*)::int from friendships
           where requester_id = tests.uid('dave') and addressee_id = tests.uid('alice')
             and status = 'blocked' and not mutual_block), 1,
  'dave''s block remains as a one-way block');
select tests.authenticate_as('alice');
select is((select count(*)::int from friendships where tests.uid('dave') in (requester_id, addressee_id)), 0,
  'alice still sees no row for the pair');
select is((select count(*)::int from list_blocked()), 0, 'alice''s list_blocked is now empty');
select is((select count(*)::int from find_user_by_username('dave')), 0, 'dave''s block still hides him from alice');
select throws_ok($$ select send_friend_request(tests.uid('dave')) $$, 'P0001', null,
  'alice cannot send dave a request while his block stands');
select tests.authenticate_as('dave');
select is((select array_agg(username::text) from list_blocked()), array['alice'], 'dave still lists alice as blocked');
select lives_ok($$ select unblock_user(tests.uid('alice')) $$, 'dave lifts his block');
reset role;
select is((select count(*)::int from friendships where tests.uid('dave') in (requester_id, addressee_id)), 0,
  'after both unblock the row is gone');

-- Edge cases ------------------------------------------------------------------------------
select tests.authenticate_as('alice');
select lives_ok($$ select block_user(tests.uid('dave')) $$, 'alice blocks dave');
select lives_ok($$ select block_user(tests.uid('dave')) $$, 'blocking someone you already block succeeds');
reset role;
select is((select count(*)::int from friendships
           where requester_id = tests.uid('alice') and addressee_id = tests.uid('dave')
             and status = 'blocked' and not mutual_block), 1,
  'a second block changes nothing');
select tests.authenticate_as('dave');
select throws_ok($$ select unblock_user(tests.uid('alice')) $$, 'P0001', null,
  'the blocked user cannot lift a one-way block');
reset role;
select throws_ok($$ update friendships set mutual_block = true
                    where requester_id = tests.uid('alice') and addressee_id = tests.uid('carol') $$,
  '23514', null, 'mutual_block is only allowed on a blocked row');

select * from finish();
rollback;
