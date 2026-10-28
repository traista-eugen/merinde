-- Households, members and invite codes (#2). A user belongs to one household (MVP).
-- Households and memberships are only created through the RPCs below.

create table public.household (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);

comment on column public.household.is_demo is 'Demo households never feed pooled prices. Only the backend sets this.';

create table public.member (
  household_id uuid not null references public.household (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  display_name text,
  diets text[] not null default '{}',
  allergies text[] not null default '{}',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  -- Drop this to allow several households per user.
  constraint member_one_household_per_user unique (user_id)
);

create table public.invite (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.household (id) on delete cascade,
  -- 8 characters without look-alikes (no I, O, 0, 1)
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);

create index on public.invite (household_id);

-- Households of the signed-in user. Security definer, so policies that use it don't recurse into member's own policies.
create function private.user_household_ids() returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.member where user_id = (select auth.uid())
$$;

create function private.user_owned_household_ids() returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id from public.member where user_id = (select auth.uid()) and role = 'owner'
$$;

-- The name from Sign in with Apple, if the user shared it; members can change it later.
create function private.user_full_name(user_id uuid) returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name')
  from auth.users u
  where u.id = user_full_name.user_id
$$;

revoke all on function private.user_full_name(uuid) from public;

revoke all on function private.user_household_ids(), private.user_owned_household_ids() from public;
grant execute on function private.user_household_ids(), private.user_owned_household_ids()
  to authenticated, service_role;

-- Access
alter table public.household enable row level security;
alter table public.member enable row level security;
alter table public.invite enable row level security;

revoke all on public.household, public.member, public.invite from anon, authenticated;
grant all on public.household, public.member, public.invite to service_role;
grant select, update (name) on public.household to authenticated;
grant select, update (display_name, diets, allergies) on public.member to authenticated;
grant select, delete on public.invite to authenticated;

create policy "Members read their household" on public.household
  for select to authenticated
  using (id in (select private.user_household_ids()));

create policy "Owners rename their household" on public.household
  for update to authenticated
  using (id in (select private.user_owned_household_ids()))
  with check (id in (select private.user_owned_household_ids()));

create policy "Members read their household's members" on public.member
  for select to authenticated
  using (household_id in (select private.user_household_ids()));

create policy "Members edit their own diets and allergies" on public.member
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Members read their household's invites" on public.invite
  for select to authenticated
  using (household_id in (select private.user_household_ids()));

create policy "Owners revoke invites" on public.invite
  for delete to authenticated
  using (household_id in (select private.user_owned_household_ids()));

-- RPCs. Errors use SQLSTATEs that PostgREST maps to HTTP statuses:
-- 42501 not signed in or not allowed (401/403), 23505 already in a household (409),
-- P0002 invalid or expired invite code (404).

-- Creates a household and makes the caller its owner. Returns the household id.
create function public.create_household(name text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  new_household uuid;
begin
  if caller is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from public.member m where m.user_id = caller) then
    raise exception 'you already belong to a household' using errcode = '23505';
  end if;

  insert into public.household (name)
  values (btrim(create_household.name))
  returning id into new_household;

  insert into public.member (household_id, user_id, role, display_name)
  values (new_household, caller, 'owner', private.user_full_name(caller));

  return new_household;
end;
$$;

-- Creates an invite code for the caller's household, valid for 7 days. Owners only.
create function public.create_invite() returns public.invite
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  owned_household uuid;
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text;
  created public.invite;
begin
  if caller is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;

  select m.household_id into owned_household
  from public.member m
  where m.user_id = caller and m.role = 'owner';

  if owned_household is null then
    raise exception 'only a household owner can invite' using errcode = '42501';
  end if;

  loop
    -- 32 symbols, so each random byte maps to one without bias
    select string_agg(substr(alphabet, get_byte(r.bytes, i) % 32 + 1, 1), '' order by i)
    into new_code
    from (select extensions.gen_random_bytes(8) as bytes) r, generate_series(0, 7) i;

    begin
      insert into public.invite (household_id, code, created_by)
      values (owned_household, new_code, caller)
      returning * into created;
      return created;
    exception when unique_violation then
      -- the code is taken: draw another
    end;
  end loop;
end;
$$;

-- Joins the household that issued the code. Spaces, dashes and case are ignored. Returns the household id.
create function public.join_household(code text) returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target uuid;
begin
  if caller is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if exists (select 1 from public.member m where m.user_id = caller) then
    raise exception 'you already belong to a household' using errcode = '23505';
  end if;

  select i.household_id into target
  from public.invite i
  where i.code = upper(regexp_replace(join_household.code, '[^A-Za-z0-9]', '', 'g'))
    and i.expires_at > now();

  if target is null then
    raise exception 'this invite code is invalid or has expired' using errcode = 'P0002';
  end if;

  insert into public.member (household_id, user_id, role, display_name)
  values (target, caller, 'member', private.user_full_name(caller));

  return target;
end;
$$;

revoke all on function public.create_household(text), public.create_invite(), public.join_household(text)
  from public, anon, service_role;
grant execute on function public.create_household(text), public.create_invite(), public.join_household(text)
  to authenticated;
