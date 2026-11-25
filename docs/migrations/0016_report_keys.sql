-- 0016: Delete my data also deletes the reports a device sent (SPEC-010 version 2 with SPEC-038).
-- What it does, in plain words:
--   1. Each report gets a random key (del_key). report_add now gives that key back to the device that sent the report
--      (nothing when the 5-in-10-minutes limit stopped it). The device keeps the key; nobody else ever sees it.
--   2. report_delete_mine deletes the reports whose keys a device hands in (at most 50 at a time). A visit code is not
--      enough, because other players in a shared world can see it; the key is known to the sending device only.
alter table public.reports add column if not exists del_key uuid not null default gen_random_uuid();
create unique index if not exists reports_del_key on public.reports (del_key);

drop function if exists public.report_add(text, text, text, text, text, int, int, int, int, int, text);
create function public.report_add(p_kind text, p_category text, p_reporter text, p_ai_line text default null,
  p_world text default null, p_x int default null, p_y int default null, p_z int default null, p_look int default null,
  p_changed int default null, p_player text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare k uuid;
begin
  if (select count(*) from public.reports where reporter = p_reporter and created_at > now() - interval '10 minutes') >= 5 then
    return null;
  end if;
  perform public.reports_purge();
  insert into public.reports (kind, category, reporter, ai_line, world_code, x, y, z, look, changed, player_code)
  values (p_kind, p_category, p_reporter,
    case when p_kind = 'ai' then p_ai_line end,
    case when p_kind in ('build', 'player') then p_world end,
    case when p_kind = 'build' then p_x end, case when p_kind = 'build' then p_y end, case when p_kind = 'build' then p_z end,
    case when p_kind = 'build' then p_look end, case when p_kind = 'build' then p_changed end,
    case when p_kind = 'player' then p_player end)
  returning del_key into k;
  return k;
end $$;
revoke all on function public.report_add(text, text, text, text, text, int, int, int, int, int, text) from public;
grant execute on function public.report_add(text, text, text, text, text, int, int, int, int, int, text) to anon, authenticated;

create or replace function public.report_delete_mine(p_keys uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if p_keys is null or array_length(p_keys, 1) is null or array_length(p_keys, 1) > 50 then return 0; end if;
  delete from public.reports where del_key = any(p_keys);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.report_delete_mine(uuid[]) from public;
grant execute on function public.report_delete_mine(uuid[]) to anon, authenticated;
