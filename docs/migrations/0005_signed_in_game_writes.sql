-- 0005 (applied to the live database 2026-11-02)
-- The game keeps a parent's sign-in in the same browser (persistSession), so game writes
-- can run as "authenticated". These policies let signed-in accounts do the same writes that
-- anonymous players already can. No new data is collected.
create policy "signed-in game can write worlds" on public.worlds
  for insert to authenticated with check (true);
create policy "signed-in game can update worlds" on public.worlds
  for update to authenticated using (true) with check (true);
create policy "signed-in game can log events" on public.game_events
  for insert to authenticated with check (true);
create policy "signed-in game can log errors" on public.game_errors
  for insert to authenticated with check (true);
create policy "signed-in game can add debug rows" on public.debug_log
  for insert to authenticated with check (true);
