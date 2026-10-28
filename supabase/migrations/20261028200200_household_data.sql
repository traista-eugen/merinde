-- Household data: pantry, recipes, meal plans, shopping list and receipts.
-- Only members of the household can read or write it.
-- Every table carries household_id, and links between them are composite foreign keys on
-- (id, household_id), so a row can never point at another household's row.

create table public.pantry_item (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  product_id uuid not null references public.product (id),
  quantity numeric(12, 3) check (quantity >= 0),
  unit public.measure_unit,
  level text check (level in ('have', 'low', 'out')),
  expires_on date,
  expiry_estimated boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  -- Tracked by amount, or by a rough level for staples like salt and oil.
  constraint pantry_item_amount_or_level check (
    (quantity is not null and unit is not null and level is null)
    or (quantity is null and unit is null and level is not null)
  )
);

create table public.pantry_event (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  pantry_item_id uuid,
  product_id uuid not null references public.product (id),
  change numeric(12, 3),
  unit public.measure_unit,
  level text check (level in ('have', 'low', 'out')),
  reason text not null check (reason in ('bought', 'cooked', 'used', 'thrown_away', 'corrected')),
  user_id uuid default auth.uid() references auth.users (id) on delete set null,
  occurred_at timestamptz not null default now(),
  foreign key (pantry_item_id, household_id)
    references public.pantry_item (id, household_id) on delete set null (pantry_item_id)
);

create index on public.pantry_event (pantry_item_id);

comment on table public.pantry_event is 'Append-only stock history; thrown_away events feed the waste stats.';
comment on column public.pantry_event.change is 'Signed amount in unit: positive when bought, negative when cooked, used or thrown away.';

create table public.recipe (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  title text not null check (btrim(title) <> ''),
  cover_colour smallint not null default 1 check (cover_colour between 1 and 6),
  is_favourite boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id)
);

create table public.recipe_variant (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  recipe_id uuid not null,
  name text not null default 'Original' check (btrim(name) <> ''),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, household_id),
  foreign key (recipe_id, household_id)
    references public.recipe (id, household_id) on delete cascade
);

create index on public.recipe_variant (recipe_id);

create table public.recipe_version (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  recipe_variant_id uuid not null,
  version integer not null check (version > 0),
  content jsonb not null,
  change_note text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (recipe_variant_id, version),
  foreign key (recipe_variant_id, household_id)
    references public.recipe_variant (id, household_id) on delete cascade
);

comment on table public.recipe_version is 'Append-only. The highest version is current; undo adds a new version with older content.';
comment on column public.recipe_version.content is 'Servings, ingredients (each with a product_id) and steps.';

create table public.meal_plan_entry (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  planned_on date not null,
  meal text not null check (meal in ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_variant_id uuid,
  servings smallint check (servings > 0),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (recipe_variant_id, household_id)
    references public.recipe_variant (id, household_id) on delete set null (recipe_variant_id)
);

create index on public.meal_plan_entry (recipe_variant_id);

create table public.shopping_list_item (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  -- Null for items added by hand that aren't matched to a product yet.
  product_id uuid references public.product (id),
  name text not null check (btrim(name) <> ''),
  quantity numeric(12, 3) check (quantity > 0),
  unit public.measure_unit,
  checked boolean not null default false,
  checked_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.receipt (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  shop_id uuid references public.shop (id),
  purchased_on date,
  total numeric(12, 2) check (total >= 0),
  currency public.currency_code not null default 'RON',
  photo_path text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (id, household_id)
);

comment on column public.receipt.photo_path is 'Object in the private receipts bucket: <household_id>/<file>.';

create table public.receipt_line (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  receipt_id uuid not null,
  line_no smallint,
  raw_text text not null,
  product_id uuid references public.product (id),
  quantity numeric(12, 3) not null default 1 check (quantity > 0),
  unit public.measure_unit not null default 'pc',
  unit_price numeric(12, 2) check (unit_price >= 0),
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  loyalty_card_discount boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (receipt_id, household_id)
    references public.receipt (id, household_id) on delete cascade
);

create index on public.receipt_line (receipt_id);

-- Keep updated_at current, for offline sync.
create trigger set_updated_at before update on public.pantry_item
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.recipe
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.recipe_variant
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.meal_plan_entry
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.shopping_list_item
  for each row execute function private.set_updated_at();

-- Records who ticked a list item and when (#29). A signed-in caller can't tick in someone else's name.
create function private.stamp_checked_by() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not new.checked then
    new.checked_by := null;
    new.checked_at := null;
  elsif tg_op = 'INSERT' or not old.checked then
    new.checked_by := coalesce(auth.uid(), new.checked_by);
    new.checked_at := coalesce(new.checked_at, now());
  end if;
  return new;
end;
$$;

create trigger stamp_checked_by before insert or update on public.shopping_list_item
  for each row execute function private.stamp_checked_by();

-- Access: members of the household, nobody else. The backend (service role) bypasses RLS.
do $$
declare
  t text;
begin
  foreach t in array array[
    'pantry_item', 'pantry_event', 'recipe', 'recipe_variant', 'recipe_version',
    'meal_plan_entry', 'shopping_list_item', 'receipt', 'receipt_line'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('create index on public.%I (household_id)', t);
    execute format(
      'create policy "Members manage their household''s rows" on public.%I
         for all to authenticated
         using (household_id in (select private.user_household_ids()))
         with check (household_id in (select private.user_household_ids()))',
      t
    );
  end loop;
end;
$$;

-- History stays as it happened.
revoke update on public.pantry_event, public.recipe_version from authenticated;

-- Live updates for every member's phone.
alter publication supabase_realtime add table public.pantry_item, public.shopping_list_item;

-- Receipt photos: a private bucket where each household has its own folder, <household_id>/<file>.
-- Photos are converted to JPEG on the phone (the AI doesn't read HEIC).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Members manage their household's receipt photos" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select h::text from private.user_household_ids() h)
  )
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (select h::text from private.user_household_ids() h)
  );
