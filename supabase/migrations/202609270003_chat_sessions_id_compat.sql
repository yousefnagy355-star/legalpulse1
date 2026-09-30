do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'chat_sessions' and column_name = 'session_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'chat_sessions' and column_name = 'id'
  ) then
    alter table public.chat_sessions rename column session_id to id;
  end if;
end
$$;

drop policy if exists "Users can read their own n8n chat history" on public.n8n_chat_histories;
create policy "Users can read their own n8n chat history"
  on public.n8n_chat_histories for select to authenticated
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id::text = n8n_chat_histories.session_id::text
        and s.user_id = (select auth.uid())
    )
  );