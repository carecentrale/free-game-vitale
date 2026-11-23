-- 0001c: Cloud save for a signed-in parent (live name: add_cloud_saves, applied 30 Oct 2026).
-- Copied on 22 Nov 2026 from the live database's own migration history, word for word.
create table if not exists public.cloud_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  save text not null check (char_length(save) <= 200000),
  updated_at timestamptz not null default now()
);
alter table public.cloud_saves enable row level security;
create policy "own save select" on public.cloud_saves for select to authenticated using (auth.uid() = user_id);
create policy "own save insert" on public.cloud_saves for insert to authenticated with check (auth.uid() = user_id);
create policy "own save update" on public.cloud_saves for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
