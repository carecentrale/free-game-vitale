-- 0015: Report anything that looks wrong (SPEC-038, approved by the owner in the PM chat on 24 Nov 2026).
-- What it does, in plain words:
--   1. reports: one row per report a child sends with taps (no typing). It holds only the kind (ai, build, player,
--      other), the category (rude, scary, wrong), for an AI line its number, for a build the world code, the place
--      (block numbers), the direction the child was looking and how many blocks players had changed in the 32 by 32
--      box around it, for a player that player's visit code, the reporter's visit code and the time. Never a name, a
--      picture or anything typed. Visit codes change on every visit, so nothing lasting is kept about a child.
--      The game can only add a report through report_add (at most 5 per visit code in 10 minutes). Nobody but the
--      owner's account can read, change or delete reports.
--   2. Reports are deleted automatically when they are older than the owner's keep period (game setting
--      reports_keep_months, 1 to 120, starts at 12), each time a report is added and when the owner opens the card.
--   3. mp_stops: "stop multiplayer" for one visit code, until a time (or until the owner lifts it). Only the owner
--      writes it; the game asks mp_stop_until for its own visit code when it joins or shares a world.
--   4. world_restores: "put the land back" in a 32 by 32 box of a shared world. Only the owner writes it; the game
--      reads the list for its world with world_restores_get and puts the box back as the seed made it, as ordinary
--      block changes, so every device and the saved world get it.

-- 1. The keep period, as a game setting (everyone reads, only the owner changes, as in 0009)
alter table public.game_settings drop constraint if exists game_settings_key_check;
alter table public.game_settings add constraint game_settings_key_check
  check (key in ('castle_gap', 'quiz_m1', 'quiz_m2', 'quiz_m3', 'quiz_m4', 'quiz_m5', 'force_update_days',
    'carts_max', 'guard_max', 'guard_step1', 'guard_step2', 'guard_step3', 'guard_step4',
    'mp_castle_stone', 'mp_roof_tile', 'mp_roof_tile_blue', 'mp_wood_floor', 'mp_pale_stone', 'mp_sandstone', 'mp_dark_stone',
    'mp_slate_roof', 'mp_window', 'mp_iron_bars', 'mp_pick', 'mp_wood_sword', 'mp_leather_armor', 'mp_iron_sword',
    'mp_iron_helmet', 'mp_gold_sword', 'mp_parts', 'ms_dirt', 'ms_stone', 'ms_castle_stone',
    'share_on', 'share_gems', 'reports_keep_months'));
alter table public.game_settings drop constraint if exists reports_keep_range;
alter table public.game_settings add constraint reports_keep_range
  check (key <> 'reports_keep_months' or value between 1 and 120);
insert into public.game_settings (key, value) values ('reports_keep_months', 12) on conflict (key) do nothing;

-- 2. Reports
create table if not exists public.reports (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('ai', 'build', 'player', 'other')),
  category text not null check (category in ('rude', 'scary', 'wrong')),
  ai_line text check (ai_line ~ '^[A-Za-z0-9_-]{1,40}$'),
  world_code text check (world_code ~ '^[A-Z]{4}$'),
  x int check (x between 0 and 400000),
  y int check (y between 0 and 95),
  z int check (z between 0 and 400000),
  look smallint check (look between 0 and 359),
  changed int check (changed between 0 and 98304),
  player_code text check (player_code ~ '^[a-z0-9]{6,40}$'),
  reporter text not null check (reporter ~ '^[a-z0-9]{6,40}$'),
  status text not null default 'open' check (status in ('open', 'done')),
  done_at timestamptz
);
create index if not exists reports_reporter_time on public.reports (reporter, created_at);
create index if not exists reports_time on public.reports (created_at);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;
grant select, update, delete on public.reports to authenticated;
drop policy if exists "owner reads reports" on public.reports;
create policy "owner reads reports" on public.reports
  for select to authenticated using ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
drop policy if exists "owner marks reports" on public.reports;
create policy "owner marks reports" on public.reports
  for update to authenticated using ((auth.jwt() ->> 'email') = 'yammay@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
drop policy if exists "owner deletes reports" on public.reports;
create policy "owner deletes reports" on public.reports
  for delete to authenticated using ((auth.jwt() ->> 'email') = 'yammay@gmail.com');

-- Deletes reports older than the owner's keep period. Anyone may call it: it only ever deletes old reports.
create or replace function public.reports_purge() returns int
language plpgsql security definer set search_path = public as $$
declare months int; n int;
begin
  select value into months from public.game_settings where key = 'reports_keep_months';
  delete from public.reports where created_at < now() - make_interval(months => coalesce(months, 12));
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.reports_purge() from public;
grant execute on function public.reports_purge() to anon, authenticated;

-- The only way the game adds a report. Returns true when it was added, false when this visit code already sent 5
-- reports in the last 10 minutes. Wrong values are refused by the table's checks.
create or replace function public.report_add(p_kind text, p_category text, p_reporter text, p_ai_line text default null,
  p_world text default null, p_x int default null, p_y int default null, p_z int default null, p_look int default null,
  p_changed int default null, p_player text default null) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.reports where reporter = p_reporter and created_at > now() - interval '10 minutes') >= 5 then
    return false;
  end if;
  perform public.reports_purge();
  insert into public.reports (kind, category, reporter, ai_line, world_code, x, y, z, look, changed, player_code)
  values (p_kind, p_category, p_reporter,
    case when p_kind = 'ai' then p_ai_line end,
    case when p_kind in ('build', 'player') then p_world end,
    case when p_kind = 'build' then p_x end, case when p_kind = 'build' then p_y end, case when p_kind = 'build' then p_z end,
    case when p_kind = 'build' then p_look end, case when p_kind = 'build' then p_changed end,
    case when p_kind = 'player' then p_player end);
  return true;
end $$;
revoke all on function public.report_add(text, text, text, text, text, int, int, int, int, int, text) from public;
grant execute on function public.report_add(text, text, text, text, text, int, int, int, int, int, text) to anon, authenticated;

-- 3. Stop multiplayer for one visit code
create table if not exists public.mp_stops (
  visit_code text primary key check (visit_code ~ '^[a-z0-9]{6,40}$'),
  world_code text check (world_code ~ '^[A-Z]{4}$'),
  until timestamptz,                       -- empty: until the owner lifts it
  created_at timestamptz not null default now()
);
alter table public.mp_stops enable row level security;
revoke all on public.mp_stops from anon, authenticated;
grant select, insert, update, delete on public.mp_stops to authenticated;
drop policy if exists "owner manages multiplayer stops" on public.mp_stops;
create policy "owner manages multiplayer stops" on public.mp_stops
  for all to authenticated using ((auth.jwt() ->> 'email') = 'yammay@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'yammay@gmail.com');

-- When multiplayer is stopped for this visit code: 'infinity' until lifted, the end time, or nothing when it is not.
create or replace function public.mp_stop_until(p_code text) returns timestamptz
language sql stable security definer set search_path = public as $$
  select coalesce(until, 'infinity'::timestamptz) from public.mp_stops
  where visit_code = p_code and (until is null or until > now());
$$;
revoke all on function public.mp_stop_until(text) from public;
grant execute on function public.mp_stop_until(text) to anon, authenticated;

-- 4. Put the land back in a 32 by 32 box of a shared world
create table if not exists public.world_restores (
  id bigint generated always as identity primary key,
  world_code text not null check (world_code ~ '^[A-Z]{4}$'),
  x int not null check (x between 0 and 400000),
  z int not null check (z between 0 and 400000),
  created_at timestamptz not null default now()
);
create index if not exists world_restores_code on public.world_restores (world_code);
alter table public.world_restores enable row level security;
revoke all on public.world_restores from anon, authenticated;
grant select, insert, delete on public.world_restores to authenticated;
drop policy if exists "owner manages world restores" on public.world_restores;
create policy "owner manages world restores" on public.world_restores
  for all to authenticated using ((auth.jwt() ->> 'email') = 'yammay@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'yammay@gmail.com');

create or replace function public.world_restores_get(p_code text) returns table (id bigint, x int, z int)
language sql stable security definer set search_path = public as $$
  select id, x, z from public.world_restores where world_code = p_code order by id;
$$;
revoke all on function public.world_restores_get(text) from public;
grant execute on function public.world_restores_get(text) to anon, authenticated;
