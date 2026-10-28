-- Pooled prices (decision 0005). The only way to add a price observation.
-- Each one comes from a receipt of a real household: it takes the receipt's shop, date and the shop's
-- currency, but keeps no link to the receipt, household or user. Demo households are skipped, so they
-- never feed pooled prices. Nobody can insert into price_observation directly, not even the service role.

-- prices: [{product_id, price_paid, regular_price, loyalty_card_needed, unit_price, price_unit}, ...]
-- Returns how many observations were added: 0 for a demo household.
create function public.record_price_observations(receipt_id uuid, prices jsonb) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  source record;
  added integer;
begin
  select r.shop_id, r.purchased_on, s.currency, h.is_demo
  into source
  from public.receipt r
  join public.household h on h.id = r.household_id
  left join public.shop s on s.id = r.shop_id
  where r.id = record_price_observations.receipt_id;

  if not found then
    raise exception 'receipt not found' using errcode = 'P0002';
  end if;
  if source.is_demo then
    return 0;
  end if;
  if source.shop_id is null or source.purchased_on is null then
    raise exception 'the receipt needs a shop and a date first' using errcode = '22023';
  end if;

  insert into public.price_observation (
    product_id, shop_id, price_paid, regular_price, loyalty_card_needed,
    unit_price, price_unit, currency, observed_on
  )
  select p.product_id, source.shop_id, p.price_paid, p.regular_price, coalesce(p.loyalty_card_needed, false),
         p.unit_price, p.price_unit, source.currency, source.purchased_on
  from jsonb_to_recordset(prices) as p (
    product_id uuid, price_paid numeric, regular_price numeric, loyalty_card_needed boolean,
    unit_price numeric, price_unit text
  );

  get diagnostics added = row_count;
  return added;
end;
$$;

-- Prices come from the backend's receipt parsing, never straight from the app.
revoke all on function public.record_price_observations(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_price_observations(uuid, jsonb) to service_role;
