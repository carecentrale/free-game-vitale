-- 0015: One place for errors. Adds where each error came from (SPEC: errors in one database, 24 Nov 2026).
-- game_errors gets a source column: 'game' (the game in a browser, the default, all existing rows),
-- 'build' (the build machine's test and build results) and 'release' (the daily push of dev to main).
-- Records hold no names and nothing typed: only a version, a short message, a step name and, for 'game', the visit code.
-- The existing insert rule (0007) still applies; the column only allows the three values listed here.
-- Not yet sent by anything except the game: the build machine and the release job need a write decision first.

alter table public.game_errors
  add column if not exists source text not null default 'game';

alter table public.game_errors
  drop constraint if exists game_errors_source_check;
alter table public.game_errors
  add constraint game_errors_source_check check (source in ('game', 'build', 'release'));

create index if not exists game_errors_source_idx on public.game_errors (source, created_at desc);
