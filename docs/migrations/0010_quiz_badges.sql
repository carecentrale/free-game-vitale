-- 0010: Quiz badge milestones set by the owner in the admin page (0.6.78, 20 Nov 2026).
-- Five more rows in game_settings: quiz_m1 to quiz_m5, the numbers of right quiz answers at which a child earns a badge.
-- Same rules as castle_gap (0009): everyone can read them (the game reads them when it opens), only the owner's account
-- can change them, and they hold nothing about any player. Nothing about the children is added or sent.
alter table public.game_settings drop constraint if exists game_settings_key_check;
alter table public.game_settings add constraint game_settings_key_check
  check (key in ('castle_gap', 'quiz_m1', 'quiz_m2', 'quiz_m3', 'quiz_m4', 'quiz_m5'));
alter table public.game_settings drop constraint if exists quiz_badge_range;
alter table public.game_settings add constraint quiz_badge_range
  check (key not like 'quiz_m%' or value between 1 and 100000);

insert into public.game_settings (key, value) values
  ('quiz_m1', 1), ('quiz_m2', 5), ('quiz_m3', 25), ('quiz_m4', 100), ('quiz_m5', 500)
on conflict (key) do nothing;
-- The policies and grants of 0009 already cover every row: anyone reads, only the owner updates, no one inserts or deletes.
