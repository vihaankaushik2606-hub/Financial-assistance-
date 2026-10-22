create table public.research_items (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
 kind text not null check (kind in ('notebook','watchlist','impact','evidence','history')),
 item_key text not null check (length(item_key) between 1 and 160),
 title text not null check (length(title)<=200),
 payload jsonb not null default '{}'::jsonb check (octet_length(payload::text)<=60000),
 updated_at timestamptz not null default now(),
 unique(user_id,kind,item_key)
);
alter table public.research_items enable row level security;
revoke all on public.research_items from anon;
grant select,insert,update,delete on public.research_items to authenticated;
create policy research_read_own on public.research_items for select to authenticated using ((select auth.uid())=user_id);
create policy research_insert_own on public.research_items for insert to authenticated with check ((select auth.uid())=user_id);
create policy research_update_own on public.research_items for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
create policy research_delete_own on public.research_items for delete to authenticated using ((select auth.uid())=user_id);