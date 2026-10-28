-- Shared catalogue (decision 0005): products, shops, receipt aliases and anonymous prices.
-- Every signed-in user reads it; only the backend writes it.
-- Price observations can only be added through record_price_observations() (see pooled_prices).

create extension if not exists pgcrypto with schema extensions;

-- Helpers used by policies and triggers; this schema isn't exposed through the API.
create schema if not exists private;
grant usage on schema private to authenticated, service_role;

create domain public.measure_unit as text
  check (value in ('g', 'kg', 'ml', 'l', 'pc'));

create domain public.currency_code as text
  check (value ~ '^[A-Z]{3}$');

create function private.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create table public.product (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null check (btrim(canonical_name) <> ''),
  category text,
  default_unit public.measure_unit not null default 'pc',
  barcode text unique,
  nutrition jsonb,
  allergens text[] not null default '{}',
  created_at timestamptz not null default now()
);

comment on column public.product.nutrition is 'Per 100 g or 100 ml, from Open Food Facts or an AI estimate.';
comment on column public.product.allergens is 'Allergen tags (the 14 EU allergens), used by the allergy check in code.';

create table public.shop (
  id uuid primary key default gen_random_uuid(),
  chain text not null check (btrim(chain) <> ''),
  branch text,
  country text not null default 'RO' check (country ~ '^[A-Z]{2}$'),
  currency public.currency_code not null default 'RON',
  created_at timestamptz not null default now(),
  unique nulls not distinct (chain, branch, country)
);

create table public.product_alias (
  id uuid primary key default gen_random_uuid(),
  chain text not null,
  raw_text text not null,
  product_id uuid not null references public.product (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (chain, raw_text)
);

create index on public.product_alias (product_id);

comment on table public.product_alias is 'At a shop chain, a raw receipt text (normalised by the backend) means this product.';

-- Deliberately has no household, receipt or user column: prices are pooled anonymously.
create table public.price_observation (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.product (id) on delete cascade,
  shop_id uuid not null references public.shop (id) on delete cascade,
  price_paid numeric(12, 2) not null check (price_paid >= 0),
  regular_price numeric(12, 2) check (regular_price >= 0),
  loyalty_card_needed boolean not null default false,
  unit_price numeric(12, 4) not null check (unit_price >= 0),
  price_unit text not null check (price_unit in ('kg', 'l', 'pc')),
  currency public.currency_code not null,
  observed_on date not null,
  created_at timestamptz not null default now()
);

create index on public.price_observation (product_id, shop_id, observed_on desc);
create index on public.price_observation (shop_id);

comment on column public.price_observation.price_paid is 'Paid for one piece, or one kg / l when sold by weight, after discounts.';
comment on column public.price_observation.regular_price is 'The same before discounts; null when there was no discount.';
comment on column public.price_observation.unit_price is 'price_paid per price_unit, so pack sizes compare fairly.';

-- Access: signed-in users read; the backend (service role) writes, except new prices.
alter table public.product enable row level security;
alter table public.shop enable row level security;
alter table public.product_alias enable row level security;
alter table public.price_observation enable row level security;

revoke all on public.product, public.shop, public.product_alias, public.price_observation
  from anon, authenticated, service_role;
grant select on public.product, public.shop, public.product_alias, public.price_observation
  to authenticated;
grant all on public.product, public.shop, public.product_alias to service_role;
grant select, update, delete on public.price_observation to service_role;

create policy "Signed-in users read products" on public.product
  for select to authenticated using (true);
create policy "Signed-in users read shops" on public.shop
  for select to authenticated using (true);
create policy "Signed-in users read aliases" on public.product_alias
  for select to authenticated using (true);
create policy "Signed-in users read prices" on public.price_observation
  for select to authenticated using (true);
