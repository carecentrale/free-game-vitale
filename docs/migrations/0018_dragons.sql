-- 0018: Dragons, every one different (SPEC-033, approved by the owner 24 Nov 2026).
-- What it does, in plain words:
--   1. Five new game settings that everyone can read and only the owner's account can change (as in 0009): how often
--      each kind of dragon lives in a square (0 to 100; 0 = never) and how many dragons in 100 have a rare colour.
--      dragon_w_drake 45, dragon_w_wyvern 30, dragon_w_great 15, dragon_w_family 10, dragon_rare_pct 5.
--   2. dragon_names: the owner's own name for each kind (up to 30 letters). Only the owner's account can read or change
--      it. The game never loads it, and no dragon name is shown to players.
-- Nothing here is about any player. Until this is applied the game uses the starting weights.
alter table public.game_settings drop constraint if exists game_settings_key_check;
alter table public.game_settings add constraint game_settings_key_check
  check (key in ('castle_gap', 'quiz_m1', 'quiz_m2', 'quiz_m3', 'quiz_m4', 'quiz_m5', 'force_update_days',
    'carts_max', 'guard_max', 'guard_step1', 'guard_step2', 'guard_step3', 'guard_step4',
    'mp_castle_stone', 'mp_roof_tile', 'mp_roof_tile_blue', 'mp_wood_floor', 'mp_pale_stone', 'mp_sandstone', 'mp_dark_stone',
    'mp_slate_roof', 'mp_window', 'mp_iron_bars', 'mp_pick', 'mp_wood_sword', 'mp_leather_armor', 'mp_iron_sword',
    'mp_iron_helmet', 'mp_gold_sword', 'mp_parts', 'ms_dirt', 'ms_stone', 'ms_castle_stone',
    'share_on', 'share_gems', 'reports_keep_months',
    'mirelo_visit_min', 'mirelo_stay_min', 'mirelo_away_hours', 'mirelo_unlock_min', 'mirelo_retry_min',
    'dragon_w_drake', 'dragon_w_wyvern', 'dragon_w_great', 'dragon_w_family', 'dragon_rare_pct'));
alter table public.game_settings drop constraint if exists dragon_range;
alter table public.game_settings add constraint dragon_range
  check (key not like 'dragon\_%' or value between 0 and 100);
insert into public.game_settings (key, value) values
  ('dragon_w_drake', 45), ('dragon_w_wyvern', 30), ('dragon_w_great', 15), ('dragon_w_family', 10), ('dragon_rare_pct', 5)
  on conflict (key) do nothing;

create table if not exists public.dragon_names (
  kind text primary key check (kind in ('drake', 'wyvern', 'great', 'family')),
  name text not null check (char_length(name) between 1 and 30),
  updated_at timestamptz not null default now()
);
alter table public.dragon_names enable row level security;
revoke all on public.dragon_names from anon, authenticated;
grant select, insert, update on public.dragon_names to authenticated;
drop policy if exists "owner names the dragons" on public.dragon_names;
create policy "owner names the dragons" on public.dragon_names
  for all to authenticated using ((auth.jwt() ->> 'email') = 'yammay@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
insert into public.dragon_names (kind, name) values
  ('drake', 'Meadow Drake'), ('wyvern', 'Long-tail Wyvern'), ('great', 'Great Sky Dragon'), ('family', 'Dragon with babies')
  on conflict (kind) do nothing;
