-- Pooled prices carry no household, and demo households never feed them (decision 0005).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

select columns_are(
  'public', 'price_observation',
  array[
    'id', 'product_id', 'shop_id', 'price_paid', 'regular_price', 'loyalty_card_needed',
    'unit_price', 'price_unit', 'currency', 'observed_on', 'created_at'
  ],
  'Price observations have no household, receipt or user column'
);
select results_eq(
  $$select confrelid::regclass::text from pg_constraint
    where conrelid = 'public.price_observation'::regclass and contype = 'f' order by 1$$,
  $$values ('product'), ('shop')$$,
  'Price observations only link to a product and a shop'
);

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'ana@example.test'),
  ('55555555-5555-5555-5555-555555555555', 'judge@example.test');
insert into public.household (id, name, is_demo) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Real', false),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Demo', true);
insert into public.member (household_id, user_id, role) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '55555555-5555-5555-5555-555555555555', 'owner');
insert into public.product (id, canonical_name, default_unit) values
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'garlic', 'g'),
  ('cccccccc-cccc-cccc-cccc-000000000002', 'milk', 'l');
insert into public.shop (id, chain, branch, currency) values
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Kaufland', 'Iasi Pacurari', 'RON');
insert into public.receipt (id, household_id, shop_id, purchased_on) values
  ('aaaaaaaa-0000-0000-0000-000000000008', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-20'),
  ('aaaaaaaa-0000-0000-0000-000000000009', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', null, null),
  ('eeeeeeee-0000-0000-0000-000000000008', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '2026-10-21');

---------------------------------------------------------------------------------------------------
-- The app can't add prices: not directly, and not through the function.
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select throws_ok(
  $$insert into public.price_observation (product_id, shop_id, price_paid, unit_price, price_unit, currency, observed_on)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1, 4, 'kg', 'RON', '2026-10-20')$$,
  '42501', null, 'A member can''t insert a price'
);
select throws_ok(
  $$select public.record_price_observations('aaaaaaaa-0000-0000-0000-000000000008',
      '[{"product_id": "cccccccc-cccc-cccc-cccc-cccccccccccc", "price_paid": 1, "unit_price": 4, "price_unit": "kg"}]')$$,
  '42501', null, 'A member can''t record prices from a receipt'
);
select throws_ok(
  $$insert into public.ai_usage (function, model) values ('recipe-generate', 'muse-spark-1.3')$$,
  '42501', null, 'A member can''t write AI usage'
);

---------------------------------------------------------------------------------------------------
-- The backend records prices from receipts.
set local role service_role;
set local request.jwt.claims to '{"role": "service_role"}';

select throws_ok(
  $$insert into public.price_observation (product_id, shop_id, price_paid, unit_price, price_unit, currency, observed_on)
    values ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 1, 4, 'kg', 'RON', '2026-10-20')$$,
  '42501', null, 'Even the service role can''t insert a price directly'
);
select is(
  public.record_price_observations('aaaaaaaa-0000-0000-0000-000000000008', $$[
    {"product_id": "cccccccc-cccc-cccc-cccc-cccccccccccc", "price_paid": 4.99, "regular_price": 5.99,
     "loyalty_card_needed": true, "unit_price": 19.96, "price_unit": "kg"},
    {"product_id": "cccccccc-cccc-cccc-cccc-000000000002", "price_paid": 7.49, "unit_price": 7.49, "price_unit": "l"}
  ]$$),
  2,
  'A real household''s receipt adds its prices'
);
select results_eq(
  $$select product_id, shop_id, price_paid, regular_price, loyalty_card_needed, unit_price, price_unit, currency, observed_on
    from public.price_observation order by price_paid$$,
  $$values
    ('cccccccc-cccc-cccc-cccc-cccccccccccc'::uuid, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 4.99, 5.99, true, 19.9600, 'kg', 'RON'::public.currency_code, '2026-10-20'::date),
    ('cccccccc-cccc-cccc-cccc-000000000002'::uuid, 'dddddddd-dddd-dddd-dddd-dddddddddddd'::uuid, 7.49, null, false, 7.4900, 'l', 'RON'::public.currency_code, '2026-10-20'::date)$$,
  'Prices take the receipt''s shop, date and the shop''s currency'
);
select is(
  public.record_price_observations('eeeeeeee-0000-0000-0000-000000000008',
    '[{"product_id": "cccccccc-cccc-cccc-cccc-cccccccccccc", "price_paid": 0.01, "unit_price": 0.04, "price_unit": "kg"}]'),
  0,
  'A demo household''s receipt adds nothing'
);
select throws_ok(
  $$select public.record_price_observations('aaaaaaaa-0000-0000-0000-000000000009',
      '[{"product_id": "cccccccc-cccc-cccc-cccc-cccccccccccc", "price_paid": 1, "unit_price": 4, "price_unit": "kg"}]')$$,
  '22023', null, 'A receipt without a shop and date adds nothing'
);
select throws_ok(
  $$select public.record_price_observations(gen_random_uuid(), '[]')$$,
  'P0002', null, 'An unknown receipt is refused'
);
select lives_ok(
  $$insert into public.ai_usage (household_id, function, model, prompt_tokens, completion_tokens)
    values (null, 'recipe-generate', 'muse-spark-1.3', 3000, 2500)$$,
  'The backend logs AI usage, with or without a household'
);

reset role;

select is(
  (select count(*)::int from public.price_observation where price_paid = 0.01),
  0,
  'The pool holds no demo prices'
);

select * from finish();
rollback;
