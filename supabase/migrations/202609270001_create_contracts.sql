create table if not exists public.contracts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  state text not null,
  contract_text text not null,
  source text not null check (source in ('text', 'file')),
  file_name text,
  analysis jsonb not null,
  raw_output text not null default '',
  risk_score smallint check (risk_score between 1 and 10),
  created_at timestamptz not null default now()
);

create index if not exists contracts_user_created_at_idx
  on public.contracts (user_id, created_at desc);

alter table public.contracts enable row level security;

drop policy if exists "Users can read their own contracts" on public.contracts;
create policy "Users can read their own contracts"
  on public.contracts for select
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own contracts" on public.contracts;
create policy "Users can create their own contracts"
  on public.contracts for insert
  with check ((select auth.uid()) = user_id);