-- Token usage per AI call, logged by the AI gateway (#23) to track the hackathon credit.
-- Only the backend (service role) writes it; members read their own household's rows.

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references public.household (id) on delete set null,
  function text not null,
  model text not null,
  prompt_tokens integer,
  completion_tokens integer,
  created_at timestamptz not null default now()
);

create index on public.ai_usage (household_id, created_at);

alter table public.ai_usage enable row level security;

revoke all on public.ai_usage from anon, authenticated;
grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;

create policy "Members read their household's AI usage" on public.ai_usage
  for select to authenticated
  using (household_id in (select private.user_household_ids()));
