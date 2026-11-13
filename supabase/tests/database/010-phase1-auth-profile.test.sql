-- FROZEN SPEC FILE. Phase 1: accounts and profiles. See docs/CONTRACTS.md "Phase 1".
begin;
select plan(30);

-- Structure -------------------------------------------------------------------
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.profiles')), false),
  'profiles exists and has RLS enabled');
select ok(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.profile_private')), false),
  'profile_private exists and has RLS enabled');
select ok(to_regprocedure('public.is_member()') is not null, 'is_member() exists');
select ok(to_regprocedure('public.is_admin()') is not null, 'is_admin() exists');

-- Fixtures (as postgres) ------------------------------------------------------
select tests.create_member('alice');
select tests.create_member('bob');
select tests.create_member('admin1', '1995-05-05', true);
select tests.create_user('ghost');      -- signed in, never finished sign-up
select tests.create_user('kid');
select tests.create_user('eighteen');
select tests.create_user('alice2');
select tests.create_user('newbie');

-- 18+ is enforced by the database ---------------------------------------------
insert into profiles (id, username) values (tests.uid('kid'), 'kid');
select throws_ok(
  $$ insert into profile_private (user_id, date_of_birth)
     values (tests.uid('kid'), (current_date - interval '18 years' + interval '1 day')::date) $$,
  '23514', null, 'DB rejects a date of birth one day short of 18');
insert into profiles (id, username) values (tests.uid('eighteen'), 'eighteen');
select lives_ok(
  $$ insert into profile_private (user_id, date_of_birth)
     values (tests.uid('eighteen'), (current_date - interval '18 years')::date) $$,
  'DB accepts someone who turns 18 today');

-- Username rules (Q3) ---------------------------------------------------------
select throws_ok($$ insert into profiles (id, username) values (tests.uid('alice2'), 'ALICE') $$,
  '23505', null, 'usernames are unique case-insensitively (ALICE vs alice)');
select throws_ok($$ insert into profiles (id, username) values (tests.uid('newbie'), 'ab') $$,
  '23514', null, 'username shorter than 3 characters is rejected');
select throws_ok($$ insert into profiles (id, username) values (tests.uid('newbie'), '1abc') $$,
  '23514', null, 'username starting with a digit is rejected');
select throws_ok($$ insert into profiles (id, username) values (tests.uid('newbie'), 'иван') $$,
  '23514', null, 'username with Cyrillic letters is rejected');
select throws_ok($$ insert into profiles (id, username) values (tests.uid('newbie'), 'abcdefghijklmnopqrstu') $$,
  '23514', null, 'username longer than 20 characters is rejected');
select lives_ok($$ insert into profiles (id, username) values (tests.uid('newbie'), 'Ivan.P_99') $$,
  'valid username with letters, digits, dot and underscore is accepted');

-- Defaults --------------------------------------------------------------------
select is((select stats_visibility::text from profiles where id = tests.uid('alice')), 'friends',
  'stats_visibility defaults to friends (Q19)');
select is((select is_admin from profiles where id = tests.uid('alice')), false, 'is_admin defaults to false');

-- As alice --------------------------------------------------------------------
select tests.authenticate_as('alice');
select is((select count(*)::int from profiles where id = tests.uid('alice')), 1, 'member reads own profile');
select is((select count(*)::int from profiles where id = tests.uid('bob')), 0, 'member cannot read a stranger''s profile');
select is((select count(*)::int from profile_private where user_id = tests.uid('alice')), 1, 'member reads own date of birth');
select is((select count(*)::int from profile_private where user_id = tests.uid('bob')), 0, 'member cannot read a stranger''s date of birth');
select is(is_member(), true, 'is_member() is true for a member');
select is(is_admin(), false, 'is_admin() is false for a normal member');
select tests.attempt($$ update profiles set is_admin = true where id = auth.uid() $$);
select tests.attempt($$ update profile_private set date_of_birth = '1990-01-01' where user_id = auth.uid() $$);
select tests.attempt($$ update profiles set username = 'hijacked' where id = tests.uid('bob') $$);
select lives_ok($$ update profiles set username = 'alice_new' where id = auth.uid() $$, 'owner can change own username');
reset role;
select is((select is_admin from profiles where id = tests.uid('alice')), false, 'member cannot make themselves admin');
select is((select date_of_birth from profile_private where user_id = tests.uid('alice')), '2000-01-01'::date,
  'member cannot change their date of birth (Q4)');
select is((select username::text from profiles where id = tests.uid('bob')), 'bob', 'member cannot change someone else''s username');
select is((select username::text from profiles where id = tests.uid('alice')), 'alice_new', 'username change by owner took effect');

-- As admin1 -------------------------------------------------------------------
select tests.authenticate_as('admin1');
select is(is_admin(), true, 'is_admin() is true for an admin');
reset role;

-- As ghost (signed in, no profile) ----------------------------------------------
select tests.authenticate_as('ghost');
select is(is_member(), false, 'is_member() is false without a profile');
select is((select count(*)::int from profiles), 0, 'non-member reads no profiles');
select tests.attempt($$ insert into profiles (id, username) values (auth.uid(), 'ghosty') $$);
select tests.attempt($$ insert into profile_private (user_id, date_of_birth) values (auth.uid(), '1990-01-01') $$);
reset role;
select is((select count(*)::int from profiles where id = tests.uid('ghost')), 0,
  'clients cannot create their own profile row (only complete-signup can)');

-- Anon --------------------------------------------------------------------------
select tests.as_anon();
select is((select count(*)::int from profiles), 0, 'signed-out clients read no profiles');
reset role;

select * from finish();
rollback;
