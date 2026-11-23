-- 0003: Only signed-in accounts may run purge_debug_log (live name: 0003_debug_log_revoke_anon, applied 2 Nov 2026).
-- Copied on 22 Nov 2026 from the live database's own migration history, word for word.
revoke execute on function public.purge_debug_log() from anon;
revoke execute on function public.purge_debug_log() from authenticated;
grant execute on function public.purge_debug_log() to authenticated;
