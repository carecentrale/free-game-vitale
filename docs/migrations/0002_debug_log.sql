-- 0002: enemy debug log (NOT APPLIED YET; waiting for the parent's approval)
--
-- What is stored: one row per enemy (or corpse) that leaves the map.
--   kind      what happened, e.g. 'enemy_off_map' or 'corpse_void'
--   version   game version
--   world_id  the world (instance) code. Shared by everyone in the same world.
--   x, y, z   position, rounded to one decimal place
--   detail    short reason and enemy type, no names or player codes
-- It does NOT store the player code, a name, or anything typed by a player.
--
-- Access:
--   The game can add rows (insert only, with length limits).
--   Only the parent's account (yammay@gmail.com, signed in by email code) can read,
--   change the retention setting, or delete rows.
--
-- Retention: 30 days by default. The parent can choose 30, 60, 90 or 365 days on the
-- admin page. purge_debug_log() deletes older rows and is run each time the admin page opens.

create table if not exists public.debug_log (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text not null check (char_length(kind) <= 40),
  version     text not null check (char_length(version) <= 20),
  world_id    text check (char_length(world_id) <= 40),
  x           real,
  y           real,
  z           real,
  detail      text check (char_length(detail) <= 200)
);

create table if not exists public.debug_settings (
  id              int primary key check (id = 1),
  retention_days  int not null default 30 check (retention_days in (30, 60, 90, 365))
);
insert into public.debug_settings (id, retention_days) values (1, 30) on conflict (id) do nothing;

alter table public.debug_log enable row level security;
alter table public.debug_settings enable row level security;

-- The game (anonymous) may only add rows to the log
create policy "game adds debug rows" on public.debug_log
  for insert to anon, authenticated
  with check (true);

-- Only the parent's account may read or delete the log and change the setting
create policy "parent reads debug log" on public.debug_log
  for select to authenticated
  using (auth.jwt() ->> 'email' = 'yammay@gmail.com');

create policy "parent deletes debug log" on public.debug_log
  for delete to authenticated
  using (auth.jwt() ->> 'email' = 'yammay@gmail.com');

create policy "parent reads retention setting" on public.debug_settings
  for select to authenticated
  using (auth.jwt() ->> 'email' = 'yammay@gmail.com');

create policy "parent changes retention setting" on public.debug_settings
  for all to authenticated
  using (auth.jwt() ->> 'email' = 'yammay@gmail.com')
  with check (auth.jwt() ->> 'email' = 'yammay@gmail.com');

-- Deletes rows older than the retention setting. Only the parent's account can run it.
create or replace function public.purge_debug_log() returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  keep_days int;
  removed   int;
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'yammay@gmail.com' then
    raise exception 'not allowed';
  end if;
  select retention_days into keep_days from public.debug_settings where id = 1;
  delete from public.debug_log
   where created_at < now() - make_interval(days => coalesce(keep_days, 30));
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_debug_log() from public;
grant execute on function public.purge_debug_log() to authenticated;

-- Open items before release (see docs/privacy-policy.md):
--  * The game can insert rows without signing in, so the log can be filled with junk.
--    The length limits and the 200-row cap per batch reduce this; full write lock-down is still open.
--  * This data collection must be described in the privacy policy before public release.
