-- 0011: Forced update limit set by the owner in the admin page (0.6.80, SPEC-019, 22 Nov 2026).
-- One more row in game_settings: force_update_days, the number of days a new version of the Android app may wait on
-- Google Play before the game forces the update (0 to 180, starting at 30; 0 forces every new version at once).
-- Same rules as castle_gap (0009): everyone can read it (the game reads it when it opens), only the owner's account
-- can change it, and it holds nothing about any player.
alter table public.game_settings drop constraint if exists game_settings_key_check;
alter table public.game_settings add constraint game_settings_key_check
  check (key in ('castle_gap', 'quiz_m1', 'quiz_m2', 'quiz_m3', 'quiz_m4', 'quiz_m5', 'force_update_days'));
alter table public.game_settings drop constraint if exists force_update_days_range;
alter table public.game_settings add constraint force_update_days_range
  check (key <> 'force_update_days' or value between 0 and 180);

insert into public.game_settings (key, value) values ('force_update_days', 30)
on conflict (key) do nothing;
-- The policies and grants of 0009 already cover every row: anyone reads, only the owner updates, no one inserts or deletes.
