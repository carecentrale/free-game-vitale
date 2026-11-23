-- 0013: Share the game and get 500 gems (SPEC-030, approved by the owner in the PM chat on 23 Nov 2026).
--   game_settings share_on (1 on, 0 off; starts on) and share_gems (1 to 5000; starts at 500), set by the owner in the
--   admin page card "Share reward (owner only)". Same rules as the other game settings (0009): everyone reads, only
--   the owner updates. They hold nothing about any player.
--   parent_shares: one "shared" mark per parent account, written when a signed-in parent taps Share the game on the
--   parent stats page. It holds the account and the date only: nothing about who the link went to, or whether it was
--   sent or opened. A game signed in to that account in the parent area reads its own mark and adds the gems once per
--   saved game (the saved game keeps its own "share reward given" mark), so a website page cannot give gems by itself.
--   Deleting the parent account deletes the mark (on delete cascade). Not stored with the purchase tables of 0008,
--   which are not applied.
alter table public.game_settings drop constraint if exists game_settings_key_check;
alter table public.game_settings add constraint game_settings_key_check
  check (key in ('castle_gap', 'quiz_m1', 'quiz_m2', 'quiz_m3', 'quiz_m4', 'quiz_m5', 'force_update_days',
    'carts_max', 'guard_max', 'guard_step1', 'guard_step2', 'guard_step3', 'guard_step4',
    'mp_castle_stone', 'mp_roof_tile', 'mp_roof_tile_blue', 'mp_wood_floor', 'mp_pale_stone', 'mp_sandstone', 'mp_dark_stone',
    'mp_slate_roof', 'mp_window', 'mp_iron_bars', 'mp_pick', 'mp_wood_sword', 'mp_leather_armor', 'mp_iron_sword',
    'mp_iron_helmet', 'mp_gold_sword', 'mp_parts', 'ms_dirt', 'ms_stone', 'ms_castle_stone',
    'share_on', 'share_gems'));
alter table public.game_settings drop constraint if exists share_range;
alter table public.game_settings add constraint share_range
  check ((key <> 'share_on' or value in (0, 1)) and (key <> 'share_gems' or value between 1 and 5000));
insert into public.game_settings (key, value) values ('share_on', 1), ('share_gems', 500) on conflict (key) do nothing;

create table if not exists public.parent_shares (
  user_id uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  shared_at timestamptz not null default now()
);
alter table public.parent_shares enable row level security;
drop policy if exists "parent reads own share mark" on public.parent_shares;
create policy "parent reads own share mark" on public.parent_shares
  for select to authenticated using (user_id = auth.uid());
drop policy if exists "parent writes own share mark" on public.parent_shares;
create policy "parent writes own share mark" on public.parent_shares
  for insert to authenticated with check (user_id = auth.uid());
revoke all on public.parent_shares from anon;
revoke update, delete, truncate on public.parent_shares from authenticated;
grant select, insert on public.parent_shares to authenticated;
