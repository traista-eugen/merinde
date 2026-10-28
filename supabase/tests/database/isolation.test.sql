-- Household data is private: a member of household A can't read or write household B's rows,
-- and anon can't read household data or the catalogue.
begin;
create extension if not exists pgtap with schema extensions;
select plan(80);

-- Ana is in household A, Bogdan in household B. Each household has one row in every table.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'bogdan@example.test');

insert into public.household (id, name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'B');
insert into public.member (household_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '22222222-2222-2222-2222-222222222222', 'owner');
insert into public.invite (household_id, code) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'AAAAAAAA'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'BBBBBBBB');

insert into public.product (id, canonical_name, default_unit) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'garlic', 'g');
insert into public.shop (id, chain, branch) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Lidl', 'Cluj Marasti');
insert into public.product_alias (chain, raw_text, product_id) values
  ('Lidl', 'GARL 250G', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
insert into public.price_observation (product_id, shop_id, price_paid, unit_price, price_unit, currency, observed_on) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 4.99, 19.96, 'kg', 'RON', '2026-10-20');

-- Row ids: <household letter>…<table number>
insert into public.pantry_item (id, household_id, product_id, quantity, unit) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 250, 'g'),
  ('bbbbbbbb-0000-0000-0000-000000000001', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 250, 'g');
insert into public.pantry_event (id, household_id, pantry_item_id, product_id, change, unit, reason) values
  ('aaaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 250, 'g', 'bought'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 250, 'g', 'bought');
insert into public.recipe (id, household_id, title) values
  ('aaaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Garlic soup'),
  ('bbbbbbbb-0000-0000-0000-000000000003', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Garlic bread');
insert into public.recipe_variant (id, household_id, recipe_id) values
  ('aaaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-000000000004', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-0000-0000-0000-000000000003');
insert into public.recipe_version (id, household_id, recipe_variant_id, version, content) values
  ('aaaaaaaa-0000-0000-0000-000000000005', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-0000-0000-000000000004', 1, '{"servings": 4}'),
  ('bbbbbbbb-0000-0000-0000-000000000005', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-0000-0000-0000-000000000004', 1, '{"servings": 2}');
insert into public.meal_plan_entry (id, household_id, planned_on, meal, recipe_variant_id) values
  ('aaaaaaaa-0000-0000-0000-000000000006', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-11-01', 'dinner', 'aaaaaaaa-0000-0000-0000-000000000004'),
  ('bbbbbbbb-0000-0000-0000-000000000006', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-11-01', 'dinner', 'bbbbbbbb-0000-0000-0000-000000000004');
insert into public.shopping_list_item (id, household_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000007', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'milk'),
  ('bbbbbbbb-0000-0000-0000-000000000007', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bread');
insert into public.receipt (id, household_id, shop_id, purchased_on, total) values
  ('aaaaaaaa-0000-0000-0000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-20', 4.99),
  ('bbbbbbbb-0000-0000-0000-000000000008', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-21', 9.98);
insert into public.receipt_line (id, household_id, receipt_id, raw_text, product_id, unit_price) values
  ('aaaaaaaa-0000-0000-0000-000000000009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'aaaaaaaa-0000-0000-0000-000000000008', 'GARL 250G', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 4.99),
  ('bbbbbbbb-0000-0000-0000-000000000009', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-0000-0000-0000-000000000008', 'GARL 250G', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 4.99);
insert into public.ai_usage (household_id, function, model, prompt_tokens, completion_tokens) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'recipe-generate', 'muse-spark-1.3', 3000, 2500),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'recipe-generate', 'muse-spark-1.3', 3000, 2500);
insert into storage.objects (bucket_id, name) values
  ('receipts', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/receipt.jpg'),
  ('receipts', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/receipt.jpg');

-- Helpers that run as the current role.
create schema tests;
grant usage on schema tests to anon, authenticated;

-- Households whose rows the current role can see in a table.
create function tests.visible_households(tbl text, col text default 'household_id') returns uuid[]
language plpgsql as $$
declare
  result uuid[];
begin
  execute format('select coalesce(array_agg(distinct %I order by %I), ''{}'') from public.%I', col, col, tbl)
  into result;
  return result;
end;
$$;

-- Number of a household's rows the current role managed to update.
create function tests.updated_rows(tbl text, set_clause text, household uuid, col text default 'household_id')
returns integer
language plpgsql as $$
declare
  n integer;
begin
  execute format('update public.%I set %s where %I = $1', tbl, set_clause, col) using household;
  get diagnostics n = row_count;
  return n;
end;
$$;

-- Number of a household's rows the current role managed to delete.
create function tests.deleted_rows(tbl text, household uuid) returns integer
language plpgsql as $$
declare
  n integer;
begin
  execute format('delete from public.%I where household_id = $1', tbl) using household;
  get diagnostics n = row_count;
  return n;
end;
$$;

---------------------------------------------------------------------------------------------------
-- Ana reads only household A.
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select is(tests.visible_households('household', 'id'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her household');
select is(tests.visible_households('member'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her household''s members');
select is(tests.visible_households('invite'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her household''s invites');
select is(tests.visible_households('pantry_item'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her pantry items');
select is(tests.visible_households('pantry_event'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her pantry events');
select is(tests.visible_households('recipe'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her recipes');
select is(tests.visible_households('recipe_variant'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her recipe variants');
select is(tests.visible_households('recipe_version'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her recipe versions');
select is(tests.visible_households('meal_plan_entry'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her meal plan');
select is(tests.visible_households('shopping_list_item'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her shopping list');
select is(tests.visible_households('receipt'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her receipts');
select is(tests.visible_households('receipt_line'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her receipt lines');
select is(tests.visible_households('ai_usage'), '{aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa}', 'Ana sees only her household''s AI usage');
select results_eq(
  $$select name from storage.objects where bucket_id = 'receipts'$$,
  $$values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/receipt.jpg')$$,
  'Ana sees only her household''s receipt photos'
);

-- Ana reads the shared catalogue.
select isnt_empty('select 1 from public.product', 'Ana reads products');
select isnt_empty('select 1 from public.shop', 'Ana reads shops');
select isnt_empty('select 1 from public.product_alias', 'Ana reads aliases');
select isnt_empty('select 1 from public.price_observation', 'Ana reads pooled prices');

-- Ana can't add rows to household B.
select throws_ok(
  $$insert into public.pantry_item (household_id, product_id, quantity, unit)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 1, 'pc')$$,
  '42501', null, 'Ana can''t add a pantry item to B'
);
select throws_ok(
  $$insert into public.pantry_event (household_id, product_id, change, unit, reason)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc', -1, 'pc', 'thrown_away')$$,
  '42501', null, 'Ana can''t add a pantry event to B'
);
select throws_ok(
  $$insert into public.recipe (household_id, title) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Planted')$$,
  '42501', null, 'Ana can''t add a recipe to B'
);
select throws_ok(
  $$insert into public.recipe_variant (household_id, recipe_id)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-0000-0000-0000-000000000003')$$,
  '42501', null, 'Ana can''t add a variant to B'
);
select throws_ok(
  $$insert into public.recipe_version (household_id, recipe_variant_id, version, content)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-0000-0000-0000-000000000004', 2, '{}')$$,
  '42501', null, 'Ana can''t add a recipe version to B'
);
select throws_ok(
  $$insert into public.meal_plan_entry (household_id, planned_on, meal)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '2026-11-02', 'lunch')$$,
  '42501', null, 'Ana can''t add to B''s meal plan'
);
select throws_ok(
  $$insert into public.shopping_list_item (household_id, name) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'eggs')$$,
  '42501', null, 'Ana can''t add to B''s shopping list'
);
select throws_ok(
  $$insert into public.receipt (household_id) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')$$,
  '42501', null, 'Ana can''t add a receipt to B'
);
select throws_ok(
  $$insert into public.receipt_line (household_id, receipt_id, raw_text)
    values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbbbbbb-0000-0000-0000-000000000008', 'EGGS')$$,
  '42501', null, 'Ana can''t add a receipt line to B'
);
select throws_ok(
  $$insert into public.member (household_id, user_id) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111')$$,
  '42501', null, 'Ana can''t add herself to B without an invite'
);
select throws_ok(
  $$insert into public.invite (household_id, code) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'CCCCCCCC')$$,
  '42501', null, 'Ana can''t create an invite for B'
);
select throws_ok(
  $$insert into public.ai_usage (household_id, function, model) values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'x', 'y')$$,
  '42501', null, 'Ana can''t write AI usage'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('receipts', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/planted.jpg')$$,
  '42501', null, 'Ana can''t upload a photo into B''s folder'
);
select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('receipts', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/second.jpg')$$,
  'Ana can upload a photo into her own folder'
);

-- Ana can't change B's rows: they're invisible to her, so nothing matches.
select is(tests.updated_rows('household', 'name = ''Mine''', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'id'), 0, 'Ana can''t rename B');
select is(tests.updated_rows('member', 'allergies = ''{nuts}''', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t edit B''s members');
select is(tests.updated_rows('pantry_item', 'quantity = 0', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t update B''s pantry');
select is(tests.updated_rows('recipe', 'title = ''Mine''', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t update B''s recipes');
select is(tests.updated_rows('recipe_variant', 'name = ''Mine''', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t update B''s variants');
select is(tests.updated_rows('meal_plan_entry', 'meal = ''lunch''', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t update B''s meal plan');
select is(tests.updated_rows('shopping_list_item', 'checked = true', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t tick B''s list');
select is(tests.updated_rows('receipt', 'total = 0', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t update B''s receipts');
select is(tests.updated_rows('receipt_line', 'discount = 1', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t update B''s receipt lines');

-- Ana can't delete B's rows.
select is(tests.deleted_rows('invite', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t delete B''s invites');
select is(tests.deleted_rows('pantry_item', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t delete B''s pantry items');
select is(tests.deleted_rows('pantry_event', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t delete B''s pantry events');
select is(tests.deleted_rows('recipe', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t delete B''s recipes');
select is(tests.deleted_rows('recipe_variant', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t delete B''s variants');
select is(tests.deleted_rows('recipe_version', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t delete B''s recipe versions');
select is(tests.deleted_rows('meal_plan_entry', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t delete B''s meal plan');
select is(tests.deleted_rows('shopping_list_item', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t delete B''s list items');
select is(tests.deleted_rows('receipt', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t delete B''s receipts');
select is(tests.deleted_rows('receipt_line', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), 0, 'Ana can''t delete B''s receipt lines');

-- Ana can't move her own row into B.
select throws_ok(
  $$update public.shopping_list_item set household_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
    where id = 'aaaaaaaa-0000-0000-0000-000000000007'$$,
  '42501', null, 'Ana can''t move a list item into B'
);

-- Ana's rows can't point at B's rows.
select throws_ok(
  $$insert into public.pantry_event (household_id, pantry_item_id, product_id, change, unit, reason)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-0000-0000-0000-000000000001', 'cccccccc-cccc-cccc-cccc-cccccccccccc', -1, 'g', 'used')$$,
  '23503', null, 'A pantry event can''t point at B''s pantry item'
);
select throws_ok(
  $$insert into public.recipe_variant (household_id, recipe_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-0000-0000-0000-000000000003')$$,
  '23503', null, 'A variant can''t hang off B''s recipe'
);
select throws_ok(
  $$insert into public.recipe_version (household_id, recipe_variant_id, version, content)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-0000-0000-0000-000000000004', 9, '{}')$$,
  '23503', null, 'A version can''t hang off B''s variant'
);
select throws_ok(
  $$insert into public.meal_plan_entry (household_id, planned_on, meal, recipe_variant_id)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '2026-11-03', 'dinner', 'bbbbbbbb-0000-0000-0000-000000000004')$$,
  '23503', null, 'A meal can''t use B''s recipe variant'
);
select throws_ok(
  $$insert into public.receipt_line (household_id, receipt_id, raw_text)
    values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-0000-0000-0000-000000000008', 'EGGS')$$,
  '23503', null, 'A receipt line can''t hang off B''s receipt'
);

-- History is append-only, even for its own household.
select throws_ok(
  $$update public.pantry_event set change = 0 where id = 'aaaaaaaa-0000-0000-0000-000000000002'$$,
  '42501', null, 'Pantry events can''t be rewritten'
);
select throws_ok(
  $$update public.recipe_version set content = '{}' where id = 'aaaaaaaa-0000-0000-0000-000000000005'$$,
  '42501', null, 'Recipe versions can''t be rewritten'
);

reset role;

select is(
  (select count(*)::int from (
    select household_id from public.pantry_item
    union all select household_id from public.pantry_event
    union all select household_id from public.recipe
    union all select household_id from public.recipe_variant
    union all select household_id from public.recipe_version
    union all select household_id from public.meal_plan_entry
    union all select household_id from public.shopping_list_item where not checked
    union all select household_id from public.receipt
    union all select household_id from public.receipt_line
  ) rows where household_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  9,
  'B''s rows are all still there, unchanged'
);

---------------------------------------------------------------------------------------------------
-- Anon reads nothing: no household data, no catalogue, no RPCs.
set local role anon;
set local request.jwt.claims to '{"role": "anon"}';

select throws_ok('select tests.visible_households(''household'', ''id'')', '42501', null, 'Anon can''t read households');
select throws_ok('select tests.visible_households(''member'')', '42501', null, 'Anon can''t read members');
select throws_ok('select tests.visible_households(''invite'')', '42501', null, 'Anon can''t read invites');
select throws_ok('select tests.visible_households(''pantry_item'')', '42501', null, 'Anon can''t read pantry items');
select throws_ok('select tests.visible_households(''pantry_event'')', '42501', null, 'Anon can''t read pantry events');
select throws_ok('select tests.visible_households(''recipe'')', '42501', null, 'Anon can''t read recipes');
select throws_ok('select tests.visible_households(''recipe_variant'')', '42501', null, 'Anon can''t read variants');
select throws_ok('select tests.visible_households(''recipe_version'')', '42501', null, 'Anon can''t read versions');
select throws_ok('select tests.visible_households(''meal_plan_entry'')', '42501', null, 'Anon can''t read meal plans');
select throws_ok('select tests.visible_households(''shopping_list_item'')', '42501', null, 'Anon can''t read shopping lists');
select throws_ok('select tests.visible_households(''receipt'')', '42501', null, 'Anon can''t read receipts');
select throws_ok('select tests.visible_households(''receipt_line'')', '42501', null, 'Anon can''t read receipt lines');
select throws_ok('select tests.visible_households(''ai_usage'')', '42501', null, 'Anon can''t read AI usage');
select is_empty($$select 1 from storage.objects where bucket_id = 'receipts'$$, 'Anon sees no receipt photos');
select throws_ok('select 1 from public.product', '42501', null, 'Anon can''t read products');
select throws_ok('select 1 from public.shop', '42501', null, 'Anon can''t read shops');
select throws_ok('select 1 from public.product_alias', '42501', null, 'Anon can''t read aliases');
select throws_ok('select 1 from public.price_observation', '42501', null, 'Anon can''t read prices');
select throws_ok($$select public.create_household('Anon')$$, '42501', null, 'Anon can''t create a household');
select throws_ok($$select public.join_household('AAAAAAAA')$$, '42501', null, 'Anon can''t join a household');

reset role;

select * from finish();
rollback;
