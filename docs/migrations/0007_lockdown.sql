-- 0007: database lockdown (game version 0.6.56).
-- NOT APPLIED until the parent approves. Apply only after game 0.6.56 is live,
-- because older game versions read and write the worlds table directly and will stop syncing shared worlds.
--
-- What it does, in plain words:
--   1. Shared worlds: the game can fetch, create or save ONE world at a time, and only by giving its code.
--      Nobody can list worlds, read them all, or change them in bulk. Saves have a size limit.
--   2. Players table: closed completely (the game no longer uses it; it is empty).
--   3. Logs (events, errors, enemy debug log): still add-only for the game, now with length limits.
--      Only the parent can read or delete them, as before.

-- ---- 1. Shared worlds: access by code only ----
create or replace function public.world_get(p_code text)
returns table(grid text, updated_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select w.grid, w.updated_at from public.worlds w
  where w.id = p_code and char_length(p_code) between 1 and 8;
$$;

create or replace function public.world_create(p_code text, p_grid text)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare n int;
begin
  if p_code is null or p_code !~ '^[A-Z]{4}$' then raise exception 'bad world code'; end if;
  if p_grid is null or char_length(p_grid) > 2000000 then raise exception 'world too large'; end if;
  insert into public.worlds(id, grid) values (p_code, p_grid) on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n = 1;   -- false when the code is already taken
end $$;

create or replace function public.world_save(p_code text, p_grid text, p_stamp timestamptz)
returns boolean
language plpgsql security definer set search_path = ''
as $$
begin
  if p_code is null or p_code !~ '^[A-Za-z0-9]{4}$' then raise exception 'bad world code'; end if;
  if p_grid is null or char_length(p_grid) > 2000000 then raise exception 'world too large'; end if;
  insert into public.worlds(id, grid, updated_at) values (p_code, p_grid, coalesce(p_stamp, now()))
  on conflict (id) do update set grid = excluded.grid, updated_at = excluded.updated_at;
  return true;
end $$;

revoke all on function public.world_get(text) from public;
revoke all on function public.world_create(text, text) from public;
revoke all on function public.world_save(text, text, timestamptz) from public;
grant execute on function public.world_get(text) to anon, authenticated;
grant execute on function public.world_create(text, text) to anon, authenticated;
grant execute on function public.world_save(text, text, timestamptz) to anon, authenticated;

drop policy if exists "anon can read worlds" on public.worlds;
drop policy if exists "anon can write worlds" on public.worlds;
drop policy if exists "anon can update worlds" on public.worlds;
drop policy if exists "signed-in game can write worlds" on public.worlds;
drop policy if exists "signed-in game can update worlds" on public.worlds;

-- ---- 2. Players table: closed ----
drop policy if exists "anon can read players" on public.players;
drop policy if exists "anon can write players" on public.players;
drop policy if exists "anon can update players" on public.players;
drop policy if exists "anon can delete players" on public.players;

-- ---- 3. Logs: add-only, with length limits ----
drop policy if exists "game can log events" on public.game_events;
drop policy if exists "signed-in game can log events" on public.game_events;
create policy "game logs events (limited)" on public.game_events
  for insert to anon, authenticated
  with check (
    char_length(coalesce(kind, '')) <= 40 and char_length(coalesce(version, '')) <= 20
    and char_length(coalesce(player_id, '')) <= 40 and char_length(coalesce(world_id, '')) <= 8
    and char_length(coalesce(detail, '')) <= 200
  );

drop policy if exists "game can log errors" on public.game_errors;
drop policy if exists "signed-in game can log errors" on public.game_errors;
create policy "game logs errors (limited)" on public.game_errors
  for insert to anon, authenticated
  with check (
    char_length(coalesce(version, '')) <= 20 and char_length(coalesce(player_id, '')) <= 40
    and char_length(coalesce(message, '')) <= 500 and char_length(coalesce(stack, '')) <= 2000
    and char_length(coalesce(where_seen, '')) <= 80
  );

drop policy if exists "game adds debug rows" on public.debug_log;
drop policy if exists "signed-in game can add debug rows" on public.debug_log;
create policy "game adds debug rows (limited)" on public.debug_log
  for insert to anon, authenticated
  with check (
    char_length(coalesce(kind, '')) <= 40 and char_length(coalesce(version, '')) <= 20
    and char_length(coalesce(world_id, '')) <= 8 and char_length(coalesce(detail, '')) <= 200
  );
