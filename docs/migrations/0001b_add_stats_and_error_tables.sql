-- 0001b: Parent stats and game errors (live name: add_stats_and_error_tables, applied 30 Oct 2026).
-- Copied on 22 Nov 2026 from the live database's own migration history, word for word.
create table public.game_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  kind text not null check (char_length(kind) <= 40),
  version text check (char_length(version) <= 20),
  player_id text check (char_length(player_id) <= 64),
  world_id text check (char_length(world_id) <= 64),
  detail text check (char_length(detail) <= 200)
);

create table public.game_errors (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  version text check (char_length(version) <= 20),
  player_id text check (char_length(player_id) <= 64),
  message text not null check (char_length(message) <= 500),
  stack text check (char_length(stack) <= 2000),
  where_seen text check (char_length(where_seen) <= 80)
);

alter table public.game_events enable row level security;
alter table public.game_errors enable row level security;

-- The game (anyone with the link) may only add rows, never read them.
create policy "game can log events" on public.game_events for insert to anon with check (true);
create policy "game can log errors" on public.game_errors for insert to anon with check (true);

-- Only the parent's signed-in account may read or clear the admin panel data.
create policy "admin reads events" on public.game_events for select to authenticated
  using ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
create policy "admin clears events" on public.game_events for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
create policy "admin reads errors" on public.game_errors for select to authenticated
  using ((auth.jwt() ->> 'email') = 'yammay@gmail.com');
create policy "admin clears errors" on public.game_errors for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'yammay@gmail.com');

create index game_events_created_idx on public.game_events (created_at desc);
create index game_errors_created_idx on public.game_errors (created_at desc);
