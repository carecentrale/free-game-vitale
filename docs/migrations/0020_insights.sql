-- 0020: Insights in the admin page (SPEC-040, approved by the owner 24 Nov 2026).
-- What it does, in plain words: two database functions that only the owner's account may run. They count the records
-- that already exist (game_events, game_errors) per day, kind, detail and game version, so the admin page can draw
-- charts without downloading thousands of rows. They change nothing and delete nothing, and no table is added.
--   insights(days, version): records per day and kind, visits per day (and how many were in a shared world), errors per
--     day and version, and the 20 most frequent errors (grouped by the first 120 characters of the message with the
--     numbers taken out, and by where it happened), with the latest stack trace of each.
--   insights_details(days, version, kind): the 10 most frequent details of one record kind. A detail is given only when
--     at least 3 different visit codes have it, and anything that looks like a visit code is taken out of it first.
-- Neither function returns a visit code or a world code.
create or replace function public.insights(p_days integer default 30, p_version text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d integer := least(greatest(coalesce(p_days, 30), 1), 90);
  since timestamptz := (date_trunc('day', now() at time zone 'utc') - make_interval(days => d - 1)) at time zone 'utc';
  v text := nullif(btrim(coalesce(p_version, '')), '');
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'yammay@gmail.com' then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'days', d,
    'versions', (select coalesce(jsonb_agg(x.ver order by x.ver), '[]'::jsonb) from (
        select version as ver from game_events where created_at >= since and version is not null
        union select version from game_errors where created_at >= since and version is not null) x),
    'activity', (select coalesce(jsonb_agg(jsonb_build_object('day', a.day, 'kind', a.kind, 'n', a.n)), '[]'::jsonb) from (
        select (created_at at time zone 'utc')::date as day, kind, count(*) as n from game_events
        where created_at >= since and (v is null or version = v) group by 1, 2) a),
    'visits', (select coalesce(jsonb_agg(jsonb_build_object('day', s.day, 'visits', s.visits, 'shared', s.shared)), '[]'::jsonb) from (
        select (created_at at time zone 'utc')::date as day, count(distinct player_id) as visits,
               count(distinct player_id) filter (where coalesce(world_id, '') <> '') as shared
        from game_events where created_at >= since and (v is null or version = v) group by 1) s),
    'errors', (select coalesce(jsonb_agg(jsonb_build_object('day', e.day, 'version', e.ver, 'n', e.n)), '[]'::jsonb) from (
        select (created_at at time zone 'utc')::date as day, coalesce(version, '?') as ver, count(*) as n from game_errors
        where created_at >= since and (v is null or version = v) group by 1, 2) e),
    'top_errors', (select coalesce(jsonb_agg(to_jsonb(t) order by t.n desc), '[]'::jsonb) from (
        select g.msg_key as message, g.where_seen, count(*) as n, min(g.day) as first_day, max(g.day) as last_day,
               array_agg(distinct g.ver order by g.ver) as versions, (array_agg(g.stack order by g.created_at desc))[1] as stack
        from (select left(regexp_replace(message, '[0-9]+', '', 'g'), 120) as msg_key, coalesce(where_seen, '') as where_seen,
                     (created_at at time zone 'utc')::date as day, coalesce(version, '?') as ver, stack, created_at
              from game_errors where created_at >= since and (v is null or version = v)) g
        group by g.msg_key, g.where_seen order by count(*) desc limit 20) t));
end $$;

create or replace function public.insights_details(p_days integer, p_version text, p_kind text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  d integer := least(greatest(coalesce(p_days, 30), 1), 90);
  since timestamptz := (date_trunc('day', now() at time zone 'utc') - make_interval(days => d - 1)) at time zone 'utc';
  v text := nullif(btrim(coalesce(p_version, '')), '');
begin
  if coalesce(auth.jwt() ->> 'email', '') <> 'yammay@gmail.com' then
    raise exception 'owner only' using errcode = '42501';
  end if;
  return (select coalesce(jsonb_agg(jsonb_build_object('detail', t.detail, 'n', t.n) order by t.n desc), '[]'::jsonb) from (
      select x.detail, count(*) as n from (
          select btrim(regexp_replace(coalesce(detail, ''), '\m[a-z0-9]{14,}\M', '', 'g')) as detail, player_id
          from game_events where created_at >= since and kind = p_kind and (v is null or version = v)) x
      where x.detail <> '' group by x.detail having count(distinct x.player_id) >= 3 order by count(*) desc limit 10) t);
end $$;

revoke all on function public.insights(integer, text) from public, anon;
revoke all on function public.insights_details(integer, text, text) from public, anon;
grant execute on function public.insights(integer, text) to authenticated;
grant execute on function public.insights_details(integer, text, text) to authenticated;
