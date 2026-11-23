-- 0012: Merchant settings set by the owner in the admin page (0.6.81, 22 Nov 2026):
--   SPEC-020 Merchant prices: one row per thing merchants sell or buy, mp_<thing> (the child buys) or ms_<thing> (the
--     child sells); value = gem price x 100 + amount (amount 1 to 64, price 1 to 500 gems); mp_parts = gems per monster part.
--     (The spec asked for one row merchant_prices; the table holds whole numbers only, so it is one row per thing.)
--   SPEC-023 Merchant traffic: carts_max, the most hover carts drawn on screen at once (1 to 20, starting at 6).
--   SPEC-021 Merchant guards: guard_max (0 to 6, starting at 4) and guard_step1 to guard_step4 (1 to 500 gems each,
--     starting at 30, 40, 50, 58; the admin page and the game check that each is bigger than the one before).
-- Same rules as castle_gap (0009): everyone can read them (the game reads them when it opens), only the owner's account
-- can change them, and they hold nothing about any player. Approved by the owner in chat on 22 Nov 2026.
alter table public.game_settings drop constraint if exists game_settings_key_check;
alter table public.game_settings add constraint game_settings_key_check
  check (key in ('castle_gap', 'quiz_m1', 'quiz_m2', 'quiz_m3', 'quiz_m4', 'quiz_m5', 'force_update_days',
    'carts_max', 'guard_max', 'guard_step1', 'guard_step2', 'guard_step3', 'guard_step4',
    'mp_castle_stone', 'mp_roof_tile', 'mp_roof_tile_blue', 'mp_wood_floor', 'mp_pale_stone', 'mp_sandstone', 'mp_dark_stone',
    'mp_slate_roof', 'mp_window', 'mp_iron_bars', 'mp_pick', 'mp_wood_sword', 'mp_leather_armor', 'mp_iron_sword',
    'mp_iron_helmet', 'mp_gold_sword', 'mp_parts', 'ms_dirt', 'ms_stone', 'ms_castle_stone'));
alter table public.game_settings drop constraint if exists carts_max_range;
alter table public.game_settings add constraint carts_max_range check (key <> 'carts_max' or value between 1 and 20);
alter table public.game_settings drop constraint if exists guard_range;
alter table public.game_settings add constraint guard_range
  check ((key <> 'guard_max' or value between 0 and 6) and (key not like 'guard_step%' or value between 1 and 500));
alter table public.game_settings drop constraint if exists merchant_price_range;
alter table public.game_settings add constraint merchant_price_range
  check ((key not like 'mp\_%' and key not like 'ms\_%') or (value % 100 between 1 and 64 and value / 100 between 1 and 500));

insert into public.game_settings (key, value) values
  ('carts_max', 6), ('guard_max', 4), ('guard_step1', 30), ('guard_step2', 40), ('guard_step3', 50), ('guard_step4', 58),
  ('mp_castle_stone', 310), ('mp_roof_tile', 206), ('mp_roof_tile_blue', 206), ('mp_wood_floor', 208), ('mp_pale_stone', 310),
  ('mp_sandstone', 310), ('mp_dark_stone', 310), ('mp_slate_roof', 310), ('mp_window', 306), ('mp_iron_bars', 306),
  ('mp_pick', 401), ('mp_wood_sword', 501), ('mp_leather_armor', 801), ('mp_iron_sword', 1501), ('mp_iron_helmet', 1501),
  ('mp_gold_sword', 3001), ('mp_parts', 101), ('ms_dirt', 108), ('ms_stone', 106), ('ms_castle_stone', 106)
on conflict (key) do nothing;
-- The policies and grants of 0009 already cover every row: anyone reads, only the owner updates, no one inserts or deletes.
