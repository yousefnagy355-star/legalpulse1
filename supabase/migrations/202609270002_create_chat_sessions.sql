create table if not exists public.chat_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New chat',
  selected_state text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists chat_sessions_user_updated_at_idx
  on public.chat_sessions (user_id, updated_at desc);

create table if not exists public.n8n_chat_histories (
  id bigserial primary key,
  session_id text not null,
  message jsonb not null
);

create index if not exists n8n_chat_histories_session_id_idx
  on public.n8n_chat_histories (session_id, id);

alter table public.chat_sessions enable row level security;
grant select, insert, update on public.chat_sessions to authenticated;

drop policy if exists "Users can read their own chat sessions" on public.chat_sessions;
create policy "Users can read their own chat sessions"
  on public.chat_sessions for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can create their own chat sessions" on public.chat_sessions;
create policy "Users can create their own chat sessions"
  on public.chat_sessions for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own chat sessions" on public.chat_sessions;
create policy "Users can update their own chat sessions"
  on public.chat_sessions for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.n8n_chat_histories enable row level security;
grant select on public.n8n_chat_histories to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'n8n_chat_histories'
      and policyname = 'Users can read their own n8n chat history'
  ) then
    execute 'create policy "Users can read their own n8n chat history" on public.n8n_chat_histories for select to authenticated using (exists (select 1 from public.chat_sessions s where s.id::text = n8n_chat_histories.session_id::text and s.user_id = (select auth.uid())))';
  end if;
end
$$;