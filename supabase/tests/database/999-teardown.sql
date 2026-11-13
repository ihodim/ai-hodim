-- FROZEN SPEC FILE. Removes the spec helpers after the run.
begin;
select plan(1);
select ok(true, 'spec run finished');
select * from finish();
rollback;

drop schema if exists tests cascade;
