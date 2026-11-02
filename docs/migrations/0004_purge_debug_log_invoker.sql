-- 0004 (applied to the live database 2026-11-02)
-- The cleanup function now runs as the signed-in caller (security invoker) instead of
-- checking the email itself. The table's delete rule (only the parent's account) decides who can delete.
-- Access for anon is removed.
create or replace function public.purge_debug_log() returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  keep_days int;
  removed   int;
begin
  select retention_days into keep_days from public.debug_settings where id = 1;
  delete from public.debug_log
   where created_at < now() - make_interval(days => coalesce(keep_days, 30));
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.purge_debug_log() from public, anon;
grant execute on function public.purge_debug_log() to authenticated;
