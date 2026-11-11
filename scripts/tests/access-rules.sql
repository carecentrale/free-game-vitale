-- Access-rule tests for the live database.
-- Run with the Supabase SQL editor or the Supabase MCP execute_sql tool, against the project.
-- It creates rows prefixed TST / 'TEST:' and deletes them at the end. It stops with an error
-- if any check fails, and prints a summary notice when everything passes.
--
-- Roles checked:
--   anon            an anonymous player (no sign-in)
--   authenticated   a signed-in account that is NOT the parent (nick@nickwiz.com)
--   parent          the parent account (yammay@gmail.com)

do $$
declare
  fails    text := '';
  passes   int := 0;
  total    int := 0;
  c_anon   text := '{"role":"anon"}';
  c_nick   text := '{"role":"authenticated","email":"nick@nickwiz.com"}';
  c_parent text := '{"role":"authenticated","email":"yammay@gmail.com"}';
begin
  -- Start clean
  delete from public.worlds where id like 'TST%';
  delete from public.game_events where detail like 'TEST:%';
  delete from public.game_errors where message like 'TEST:%';
  delete from public.debug_log where detail like 'TEST:%';

  -- Runs one statement as a role and returns 'ok:<rows>' or 'err:<message>'
  -- p_mode 'dml'   = insert / update / delete (counts affected rows)
  -- p_mode 'count' = a select that returns a single number (returned as the value)
  create or replace function pg_temp.try_as(p_role text, p_claims text, p_sql text, p_mode text)
  returns text language plpgsql as $f$
  declare res text; n int := 0;
  begin
    execute format('set local role %I', p_role);
    perform set_config('request.jwt.claims', p_claims, true);
    begin
      if p_mode = 'count' then
        execute p_sql into n;
        res := 'ok:' || coalesce(n, 0);
      else
        execute p_sql;
        get diagnostics n = row_count;
        res := 'ok:' || n;
      end if;
    exception when others then
      res := 'err:' || sqlerrm;
    end;
    reset role;
    return res;
  end $f$;

  -- Checks: name | role | claims | sql | mode | expected (LIKE pattern)
  create temp table checks(
    seq serial, name text, p_role text, p_claims text, p_sql text, p_mode text, expected text
  ) on commit drop;

  insert into checks(name, p_role, p_claims, p_sql, p_mode, expected) values
    -- A player can save a world and log events, whether or not signed in
    -- From 0.6.56 (migration 0007): worlds are reached only through the by-code functions
    ('anon creates a world by code',       'anon',          c_anon,   $q$select public.world_create('TSTA','x')::int$q$, 'count', 'ok:1'),
    ('anon cannot reuse a taken code',     'anon',          c_anon,   $q$select public.world_create('TSTA','x')::int$q$, 'count', 'ok:0'),
    ('anon cannot insert a world directly','anon',          c_anon,   $q$insert into public.worlds(id,grid) values ('TSTB','x')$q$, 'dml', 'err:%'),
    ('anon cannot list worlds',            'anon',          c_anon,   $q$select count(*) from public.worlds$q$, 'count', 'ok:0'),
    ('anon cannot delete worlds',          'anon',          c_anon,   $q$delete from public.worlds where id like 'TST%'$q$, 'dml', 'ok:0'),
    ('world too large is refused',         'anon',          c_anon,   $q$select public.world_save('TSTA', repeat('x', 2000001), now())::int$q$, 'count', 'err:%'),
    ('anon cannot read players',           'anon',          c_anon,   $q$select count(*) from public.players$q$, 'count', 'ok:0'),
    ('anon cannot add players',            'anon',          c_anon,   $q$insert into public.players(world_id,player_id) values ('TSTA','TEST')$q$, 'dml', 'err:%'),
    ('over-long event is refused',         'anon',          c_anon,   $q$insert into public.game_events(kind,version,detail) values ('test','0','TEST:' || repeat('x', 300))$q$, 'dml', 'err:%'),
    ('anon logs event',                    'anon',          c_anon,   $q$insert into public.game_events(kind,version,player_id,detail) values ('test','0','TEST','TEST:anon')$q$, 'dml', 'ok:1'),
    ('anon logs error',                    'anon',          c_anon,   $q$insert into public.game_errors(version,message,where_seen) values ('0','TEST:anon','test')$q$, 'dml', 'ok:1'),
    ('anon adds debug row',                'anon',          c_anon,   $q$insert into public.debug_log(kind,version,detail) values ('test','0','TEST:anon')$q$, 'dml', 'ok:1'),
    ('anon reads a world by its code',     'anon',          c_anon,   $q$select count(*) from public.world_get('TSTA')$q$, 'count', 'ok:1'),
    ('anon saves a world by its code',     'anon',          c_anon,   $q$select public.world_save('TSTA','y', now())::int$q$, 'count', 'ok:1'),
    ('anon cannot update a world directly','anon',          c_anon,   $q$update public.worlds set grid='z' where id='TSTA'$q$, 'dml', 'ok:0'),

    -- Regression for the bug fixed in 0.6.19 / migration 0005: a signed-in (non-parent) account must still save
    ('signed-in creates a world by code',  'authenticated', c_nick,   $q$select public.world_create('TSTN','x')::int$q$, 'count', 'ok:1'),
    ('signed-in saves a world by its code','authenticated', c_nick,   $q$select public.world_save('TSTN','z', now())::int$q$, 'count', 'ok:1'),
    ('signed-in logs event',               'authenticated', c_nick,   $q$insert into public.game_events(kind,version,player_id,detail) values ('test','0','TEST','TEST:nick')$q$, 'dml', 'ok:1'),
    ('signed-in logs error',               'authenticated', c_nick,   $q$insert into public.game_errors(version,message,where_seen) values ('0','TEST:nick','test')$q$, 'dml', 'ok:1'),
    ('signed-in adds debug row',           'authenticated', c_nick,   $q$insert into public.debug_log(kind,version,detail) values ('test','0','TEST:nick')$q$, 'dml', 'ok:1'),

    -- Privacy: only the parent can read or delete the stats and logs
    ('anon cannot read events',            'anon',          c_anon,   $q$select count(*) from public.game_events where detail like 'TEST:%'$q$, 'count', 'ok:0'),
    ('anon cannot read debug log',         'anon',          c_anon,   $q$select count(*) from public.debug_log where detail like 'TEST:%'$q$, 'count', 'ok:0'),
    ('anon cannot read retention setting', 'anon',          c_anon,   $q$select count(*) from public.debug_settings$q$, 'count', 'ok:0'),
    ('anon cannot delete events',          'anon',          c_anon,   $q$delete from public.game_events where detail like 'TEST:%'$q$, 'dml', 'ok:0'),
    ('signed-in (not parent) cannot read events', 'authenticated', c_nick, $q$select count(*) from public.game_events where detail like 'TEST:%'$q$, 'count', 'ok:0'),
    ('signed-in (not parent) cannot delete debug log', 'authenticated', c_nick, $q$delete from public.debug_log where detail like 'TEST:%'$q$, 'dml', 'ok:0'),
    ('parent reads events',                'authenticated', c_parent, $q$select count(*) from public.game_events where detail like 'TEST:%'$q$, 'count', 'ok:%'),
    ('parent reads debug log',             'authenticated', c_parent, $q$select count(*) from public.debug_log where detail like 'TEST:%'$q$, 'count', 'ok:%'),
    ('parent reads retention setting',     'authenticated', c_parent, $q$select count(*) from public.debug_settings$q$, 'count', 'ok:1'),

    -- The cleanup function: parent only, never anonymous
    ('anon cannot run cleanup',            'anon',          c_anon,   $q$select public.purge_debug_log()$q$, 'count', 'err:%'),
    ('signed-in (not parent) can run cleanup, but deletes only what RLS allows', 'authenticated', c_nick, $q$select public.purge_debug_log()$q$, 'count', 'ok:%'),
    ('parent can run cleanup',             'authenticated', c_parent, $q$select public.purge_debug_log()$q$, 'count', 'ok:%');

  -- Run each check
  declare
    rec record;
    got text;
  begin
    for rec in select * from checks order by seq loop
      got := pg_temp.try_as(rec.p_role, rec.p_claims, rec.p_sql, rec.p_mode);
      total := total + 1;
      if got like rec.expected then
        passes := passes + 1;
      else
        fails := fails || format(E'\n  FAIL: %s  (expected %s, got %s)', rec.name, rec.expected, got);
      end if;
    end loop;
  end;

  -- Cleanup of test rows (run as the database owner)
  delete from public.worlds where id like 'TST%';
  delete from public.game_events where detail like 'TEST:%';
  delete from public.game_errors where message like 'TEST:%';
  delete from public.debug_log where detail like 'TEST:%';

  if fails <> '' then
    raise exception 'Access-rule tests: % of % failed:%', total - passes, total, fails;
  end if;
  raise notice 'Access-rule tests: all % checks passed', total;
end $$;
