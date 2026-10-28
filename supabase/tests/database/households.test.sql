-- Creating a household, inviting with a code and joining (#2). A user belongs to one household.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11111111-1111-1111-1111-111111111111', 'ana@example.test', '{"full_name": "Ana Popescu"}'),
  ('22222222-2222-2222-2222-222222222222', 'bogdan@example.test', '{}'),
  ('33333333-3333-3333-3333-333333333333', 'carmen@example.test', '{}'),
  ('44444444-4444-4444-4444-444444444444', 'dan@example.test', '{}');

---------------------------------------------------------------------------------------------------
-- Ana creates a household and becomes its owner.
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok($$select public.create_household('   ')$$, '23514', null, 'A household needs a name');
select lives_ok(
  $$select set_config('tests.household', public.create_household('  Popescu  ')::text, true)$$,
  'Ana creates a household'
);
select results_eq(
  $$select id, name, is_demo from public.household$$,
  $$values (current_setting('tests.household')::uuid, 'Popescu', false)$$,
  'Ana sees her new household, trimmed and not a demo'
);
select results_eq(
  $$select user_id, role, display_name from public.member$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid, 'owner', 'Ana Popescu')$$,
  'Ana is its owner, named from her sign-in'
);
select throws_ok($$select public.create_household('Second')$$, '23505', null, 'Ana can''t create a second household');
select throws_ok(
  $$update public.household set is_demo = true$$,
  '42501', null, 'Members can''t mark their household as a demo'
);
select lives_ok($$update public.household set name = 'Familia Popescu'$$, 'The owner can rename the household');

-- Ana creates an invite.
select lives_ok(
  $$select set_config('tests.code', (public.create_invite()).code, true)$$,
  'The owner creates an invite code'
);
select matches(current_setting('tests.code'), '^[A-HJ-NP-Z2-9]{8}$', 'The code is 8 characters without look-alikes');
select ok(
  (select expires_at between now() + interval '6 days' and now() + interval '8 days'
   from public.invite where code = current_setting('tests.code')),
  'The code expires in about a week'
);

---------------------------------------------------------------------------------------------------
-- Bogdan joins with the code, typed in lower case with a dash.
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is_empty('select 1 from public.household', 'Before joining, Bogdan sees no household');
select is(
  public.join_household(lower(substr(current_setting('tests.code'), 1, 4) || '-' || substr(current_setting('tests.code'), 5))),
  current_setting('tests.household')::uuid,
  'Bogdan joins with the invite code'
);
select results_eq(
  $$select name from public.household$$,
  $$values ('Familia Popescu')$$,
  'Bogdan now sees the household'
);
select results_eq(
  $$select user_id, role from public.member order by role desc$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid, 'owner'), ('22222222-2222-2222-2222-222222222222'::uuid, 'member')$$,
  'Bogdan is a member next to Ana'
);
select throws_ok($$select public.join_household(current_setting('tests.code'))$$, '23505', null, 'Bogdan can''t join twice');
select throws_ok($$select public.create_household('Mine')$$, '23505', null, 'Bogdan can''t also create a household');
select throws_ok($$select public.create_invite()$$, '42501', null, 'Only the owner creates invites');
select lives_ok(
  $$update public.household set name = 'Renamed by Bogdan'$$,
  'A member''s rename runs but changes nothing'
);
select results_eq($$select name from public.household$$, $$values ('Familia Popescu')$$, 'Only the owner renames the household');

-- Bogdan records his own allergies, but can't change Ana's.
update public.member set allergies = '{nuts}' where user_id = '22222222-2222-2222-2222-222222222222';
update public.member set allergies = '{gluten}' where user_id = '11111111-1111-1111-1111-111111111111';
select results_eq(
  $$select user_id, allergies from public.member order by role desc$$,
  $$values ('11111111-1111-1111-1111-111111111111'::uuid, '{}'::text[]), ('22222222-2222-2222-2222-222222222222'::uuid, '{nuts}'::text[])$$,
  'Members edit only their own allergies'
);
select throws_ok(
  $$update public.member set role = 'owner' where user_id = '22222222-2222-2222-2222-222222222222'$$,
  '42501', null, 'Members can''t make themselves owner'
);

---------------------------------------------------------------------------------------------------
-- Carmen already has her own household, so she can't join a second one.
set local request.jwt.claims to '{"sub": "33333333-3333-3333-3333-333333333333", "role": "authenticated"}';

select lives_ok($$select public.create_household('Ionescu')$$, 'Carmen creates her own household');
select throws_ok(
  $$select public.join_household(current_setting('tests.code'))$$,
  '23505', null, 'Joining a second household is refused'
);

---------------------------------------------------------------------------------------------------
-- Dan has no household: wrong and expired codes are refused.
set local request.jwt.claims to '{"sub": "44444444-4444-4444-4444-444444444444", "role": "authenticated"}';

select throws_ok($$select public.join_household('ZZZZ-ZZZZ')$$, 'P0002', null, 'An unknown code is refused');

reset role;
update public.invite set expires_at = now() - interval '1 minute' where code = current_setting('tests.code');
set local role authenticated;

select throws_ok(
  $$select public.join_household(current_setting('tests.code'))$$,
  'P0002', null, 'An expired code is refused'
);
select is_empty('select 1 from public.member', 'Dan is still in no household');

reset role;

select results_eq(
  $$select h.name, count(*)::int from public.member m join public.household h on h.id = m.household_id group by h.name order by h.name$$,
  $$values ('Familia Popescu', 2), ('Ionescu', 1)$$,
  'Each user is in exactly one household'
);
select throws_ok(
  $$insert into public.member (household_id, user_id) values (current_setting('tests.household')::uuid, '33333333-3333-3333-3333-333333333333')$$,
  '23505', null, 'The database itself refuses a second membership, even from the backend'
);

select * from finish();
rollback;
