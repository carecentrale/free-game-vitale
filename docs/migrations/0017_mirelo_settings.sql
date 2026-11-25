-- 0017: Mirelo's timings (SPEC-028, approved by the owner 23 Nov 2026).
-- What it does, in plain words: five new game settings that everyone can read and only the owner's account can change
-- (as in 0009). They hold nothing about any player.
--   mirelo_visit_min   minutes of play between his visits (1 to 120, starts at 15)
--   mirelo_stay_min    minutes a visit lasts (1 to 10, starts at 3)
--   mirelo_away_hours  hours he stays away after "Come back later" (1 to 168, starts at 24)
--   mirelo_unlock_min  minutes of play from Fighting level 2 before the fireball unlocks without the lesson (1 to 30, starts at 5)
--   mirelo_retry_min   minutes before he comes back after "Not now" on the lesson (1 to 30, starts at 2)
-- Until this is applied the game uses the starting values.
alter table public.game_settings drop constraint if exists game_settings_key_check;
alter table public.game_settings add constraint game_settings_key_check
  check (key in ('castle_gap', 'quiz_m1', 'quiz_m2', 'quiz_m3', 'quiz_m4', 'quiz_m5', 'force_update_days',
    'carts_max', 'guard_max', 'guard_step1', 'guard_step2', 'guard_step3', 'guard_step4',
    'mp_castle_stone', 'mp_roof_tile', 'mp_roof_tile_blue', 'mp_wood_floor', 'mp_pale_stone', 'mp_sandstone', 'mp_dark_stone',
    'mp_slate_roof', 'mp_window', 'mp_iron_bars', 'mp_pick', 'mp_wood_sword', 'mp_leather_armor', 'mp_iron_sword',
    'mp_iron_helmet', 'mp_gold_sword', 'mp_parts', 'ms_dirt', 'ms_stone', 'ms_castle_stone',
    'share_on', 'share_gems', 'reports_keep_months',
    'mirelo_visit_min', 'mirelo_stay_min', 'mirelo_away_hours', 'mirelo_unlock_min', 'mirelo_retry_min'));
alter table public.game_settings drop constraint if exists mirelo_range;
alter table public.game_settings add constraint mirelo_range check (
  (key <> 'mirelo_visit_min' or value between 1 and 120) and
  (key <> 'mirelo_stay_min' or value between 1 and 10) and
  (key <> 'mirelo_away_hours' or value between 1 and 168) and
  (key <> 'mirelo_unlock_min' or value between 1 and 30) and
  (key <> 'mirelo_retry_min' or value between 1 and 30));
insert into public.game_settings (key, value) values
  ('mirelo_visit_min', 15), ('mirelo_stay_min', 3), ('mirelo_away_hours', 24), ('mirelo_unlock_min', 5), ('mirelo_retry_min', 2)
  on conflict (key) do nothing;
