-- Run this in the Supabase SQL Editor for your AI Finance Lab project.
create table if not exists public.analysis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  kind text not null check (kind in ('ai-assistant', 'company-analysis', 'manual-analysis')),
  title text not null check (char_length(title) <= 160),
  content text not null check (char_length(content) <= 12000),
  created_at timestamptz not null default now()
);

create index if not exists analysis_history_user_created_idx
  on public.analysis_history (user_id, created_at desc);

alter table public.analysis_history enable row level security;

drop policy if exists "Users can read their own analysis history" on public.analysis_history;
create policy "Users can read their own analysis history"
  on public.analysis_history for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own analysis history" on public.analysis_history;
create policy "Users can insert their own analysis history"
  on public.analysis_history for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users can delete their own analysis history" on public.analysis_history;
create policy "Users can delete their own analysis history"
  on public.analysis_history for delete to authenticated
  using ((select auth.uid()) = user_id);

grant select, insert, delete on public.analysis_history to authenticated;
revoke all on public.analysis_history from anon;
